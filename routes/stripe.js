const express = require('express');
const Stripe = require('stripe');
const crypto = require('crypto');
const db = require('../db');
const logger = require('../logger');

const router = express.Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Generate a random API key with tier prefix
function generateApiKey(tier) {
  const prefix = tier === 'pro' ? 'tf_pro_' : 'tf_free_';
  return prefix + crypto.randomBytes(20).toString('hex');
}

// Handle Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('Webhook signature verification failed', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId ? parseInt(session.metadata.userId) : null;
        const plan = session.metadata?.plan || 'pro';

        // Upsert customer record
        const stripeCustomerId = session.customer;
        const email = session.customer_details?.email || session.metadata?.email;

        if (userId) {
          db.prepare('UPDATE users SET stripe_customer_id = ?, tier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(stripeCustomerId, plan, userId);

          // Upgrade existing API keys for this user
          db.prepare('UPDATE api_keys SET tier = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked = 0')
            .run(plan, userId);

          // Create subscription record
          if (session.subscription) {
            const existing = db.prepare('SELECT id FROM subscriptions WHERE stripe_subscription_id = ?').get(session.subscription);
            if (!existing) {
              db.prepare(
                'INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_customer_id, status, plan) VALUES (?, ?, ?, ?, ?)'
              ).run(userId, session.subscription, stripeCustomerId, 'active', plan);
            }
          }
        }

        // Upsert legacy customers table
        const existingCustomer = db.prepare('SELECT * FROM customers WHERE stripe_customer_id = ?').get(stripeCustomerId);
        if (existingCustomer) {
          db.prepare('UPDATE customers SET tier = ?, updated_at = CURRENT_TIMESTAMP WHERE stripe_customer_id = ?').run(plan, stripeCustomerId);
        } else {
          db.prepare('INSERT INTO customers (stripe_customer_id, email, tier) VALUES (?, ?, ?)').run(stripeCustomerId, email, plan);
        }

        logger.info('Checkout completed', { stripeCustomerId, userId, plan });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const status = subscription.status;
        const cancelAtPeriodEnd = subscription.cancel_at_period_end ? 1 : 0;

        db.prepare(`
          UPDATE subscriptions
          SET status = ?, cancel_at_period_end = ?,
              current_period_start = datetime(?, 'unixepoch'),
              current_period_end = datetime(?, 'unixepoch'),
              updated_at = CURRENT_TIMESTAMP
          WHERE stripe_subscription_id = ?
        `).run(
          status, cancelAtPeriodEnd,
          subscription.current_period_start,
          subscription.current_period_end,
          subscription.id
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;

        db.prepare('UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE stripe_subscription_id = ?')
          .run('canceled', subscription.id);

        // Downgrade user
        const user = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(stripeCustomerId);
        if (user) {
          db.prepare('UPDATE users SET tier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('free', user.id);
          db.prepare('UPDATE api_keys SET tier = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked = 0').run('free', user.id);
        }

        // Downgrade legacy customers table
        db.prepare('UPDATE customers SET tier = ?, updated_at = CURRENT_TIMESTAMP WHERE stripe_customer_id = ?').run('free', stripeCustomerId);

        logger.info('Subscription cancelled', { stripeCustomerId });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const stripeCustomerId = invoice.customer;

        const user = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(stripeCustomerId);
        const userId = user ? user.id : null;

        const existing = db.prepare('SELECT id FROM invoices WHERE stripe_invoice_id = ?').get(invoice.id);
        if (!existing) {
          db.prepare(`
            INSERT INTO invoices (user_id, stripe_invoice_id, stripe_customer_id, amount_paid, currency, status, invoice_url, invoice_pdf, period_start, period_end)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime(?, 'unixepoch'), datetime(?, 'unixepoch'))
          `).run(
            userId, invoice.id, stripeCustomerId,
            invoice.amount_paid, invoice.currency, invoice.status,
            invoice.hosted_invoice_url || null, invoice.invoice_pdf || null,
            invoice.period_start, invoice.period_end
          );
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const stripeCustomerId = invoice.customer;

        db.prepare('UPDATE customers SET tier = ?, updated_at = CURRENT_TIMESTAMP WHERE stripe_customer_id = ?').run('free', stripeCustomerId);

        const user = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(stripeCustomerId);
        if (user) {
          db.prepare('UPDATE users SET tier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('free', user.id);
        }

        logger.warn('Invoice payment failed', { stripeCustomerId });
        break;
      }

      default:
        logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  } catch (err) {
    logger.error('Webhook handler error', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  res.json({ received: true });
});

module.exports = router;
