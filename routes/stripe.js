const express = require('express');
const Stripe = require('stripe');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const logger = require('../logger');
const { generateApiKey, hashApiKey } = require('../apiKeys');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Tier → price ID mapping
const TIER_PRICE_MAP = {
  free: null, // free tier has no price ID
  pro: process.env.STRIPE_PRO_PRICE_ID || process.env.STRIPE_PRICE_ID, // Pro plan price ID
};

// Stricter rate limit for key management endpoints to prevent enumeration / abuse.
const keyManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests to key management endpoint, please try again later.' },
});

// ──────────────────────────────────────────────
// API Keys
// ──────────────────────────────────────────────

// GET /api/keys  — list all API keys
router.get('/keys', keyManagementLimiter, async (req, res) => {
  try {
    const keys = await db.query('SELECT id, key, tier, customer_id, created_at FROM api_keys ORDER BY created_at DESC');
    res.json({ success: true, keys: keys.rows });
  } catch (error) {
    logger.error('Error fetching API keys', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// POST /api/keys  — create a new API key (server-side secure generation)
router.post('/keys', keyManagementLimiter, async (req, res) => {
  try {
    const { customer_id, tier = 'pro' } = req.body || {};
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    const result = await db.query(
      'INSERT INTO api_keys (key, key_hash, customer_id, tier) VALUES ($1, $2, $3, $4) RETURNING id, key, tier, customer_id, created_at',
      [apiKey, apiKeyHash, customer_id || null, tier]
    );

    logger.info('API key created', { id: result.rows[0].id, tier });
    res.status(201).json({ success: true, key: result.rows[0] });
  } catch (error) {
    logger.error('Error creating API key', { error: error.message });
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// DELETE /api/keys/:id  — revoke an API key by id
router.delete('/keys/:id', keyManagementLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM api_keys WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }
    logger.info('API key revoked', { id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error revoking API key', { error: error.message });
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

// ──────────────────────────────────────────────
// Checkout
// ──────────────────────────────────────────────

// POST /api/create-checkout-session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { email, customerId, tier = 'pro' } = req.body;

    const priceId = TIER_PRICE_MAP[tier];
    if (!priceId) {
      return res.status(400).json({ error: `Unknown tier: ${tier}` });
    }

    // Create or retrieve customer
    let customer;
    if (customerId) {
      customer = await stripe.customers.retrieve(customerId);
    } else {
      customer = await stripe.customers.create({ email });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/billing?success=true`,
      cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/billing?canceled=true`,
      metadata: {
        email: email || customer.email,
        tier,
      },
      // Allow promotion codes
      allow_promotion_codes: true,
      // Collect billing address
      billing_address_collection: 'required',
    });

    res.json({ 
      sessionId: session.id, 
      customerId: customer.id,
      checkoutUrl: session.url  // Return the Stripe Checkout URL directly
    });
  } catch (error) {
    logger.error('Error creating checkout session', { error: error.message });
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ──────────────────────────────────────────────
// Billing status
// ──────────────────────────────────────────────

// GET /api/billing/status?customerId=cus_xxx
router.get('/billing/status', async (req, res) => {
  try {
    const { customerId } = req.query;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId query parameter required' });
    }

    const customer = await db.get('SELECT * FROM customers WHERE stripe_customer_id = $1', [customerId]);

    if (!customer) {
      // Customer not in DB yet (webhook hasn't fired) - fetch from Stripe directly
      try {
        const stripeCustomer = await stripe.customers.retrieve(customerId);
        if (stripeCustomer.deleted) {
          return res.status(404).json({ error: 'Customer not found' });
        }
        
        // Try to get subscription from Stripe
        let subscription = null;
        let tier = 'free';
        let subscriptionStatus = 'inactive';
        let currentPeriodEnd = null;
        let cancelAtPeriodEnd = false;

        if (stripeCustomer.subscriptions?.data?.length > 0) {
          subscription = stripeCustomer.subscriptions.data[0];
          tier = subscription.metadata?.tier || 'pro';
          subscriptionStatus = subscription.status;
          currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
          cancelAtPeriodEnd = subscription.cancel_at_period_end;
        }

        return res.json({
          customerId: stripeCustomer.id,
          email: stripeCustomer.email,
          tier,
          subscriptionStatus,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          pending: true // Indicates webhook hasn't synced yet
        });
      } catch (stripeErr) {
        return res.status(404).json({ error: 'Customer not found' });
      }
    }

    // Fetch live subscription from Stripe when a subscription_id is stored
    let subscription = null;
    if (customer.subscription_id) {
      try {
        subscription = await stripe.subscriptions.retrieve(customer.subscription_id);
      } catch {
        // Subscription may have been deleted; fall through
      }
    }

    res.json({
      customerId: customer.stripe_customer_id,
      email: customer.email,
      tier: customer.tier,
      subscriptionStatus: subscription ? subscription.status : customer.subscription_status,
      currentPeriodEnd: subscription
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : customer.current_period_end,
      cancelAtPeriodEnd: subscription
        ? subscription.cancel_at_period_end
        : Boolean(customer.cancel_at_period_end),
    });
  } catch (error) {
    logger.error('Error fetching billing status', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch billing status' });
  }
});

// ──────────────────────────────────────────────
// Customer Portal
// ──────────────────────────────────────────────

// GET /api/billing/portal?customerId=cus_xxx  — redirects to Stripe portal
router.get('/billing/portal', async (req, res) => {
  try {
    const { customerId } = req.query;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId query parameter required' });
    }

    const returnUrl =
      req.query.returnUrl ||
      `${process.env.BASE_URL || 'http://localhost:3000'}/billing`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    res.redirect(302, portalSession.url);
  } catch (error) {
    logger.error('Error creating customer portal session', { error: error.message });
    res.status(500).json({ error: 'Failed to create customer portal session' });
  }
});

// POST /api/billing/customer-portal — returns portal URL as JSON
router.post('/billing/customer-portal', async (req, res) => {
  try {
    const { customerId, returnUrl } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId required' });
    }

    const portalReturnUrl =
      returnUrl || `${process.env.BASE_URL || 'http://localhost:3000'}/billing`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: portalReturnUrl,
    });

    res.json({ url: portalSession.url });
  } catch (error) {
    logger.error('Error creating customer portal session', { error: error.message });
    res.status(500).json({ error: 'Failed to create customer portal session' });
  }
});

// ──────────────────────────────────────────────
// Invoices
// ──────────────────────────────────────────────

// GET /api/billing/invoices?customerId=cus_xxx
router.get('/billing/invoices', async (req, res) => {
  try {
    const { customerId } = req.query;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId query parameter required' });
    }

    const invoices = db
      .prepare(
        'SELECT * FROM invoices WHERE stripe_customer_id = ? ORDER BY created_at DESC LIMIT 50'
      )
      .all(customerId);

    res.json({ invoices });
  } catch (error) {
    logger.error('Error fetching invoices', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// ──────────────────────────────────────────────
// Subscription management
// ──────────────────────────────────────────────

// POST /api/billing/subscription/update
// Body: { customerId, tier }
router.post('/billing/subscription/update', async (req, res) => {
  try {
    const { customerId, tier } = req.body;
    if (!customerId || !tier) {
      return res.status(400).json({ error: 'customerId and tier required' });
    }

    const newPriceId = TIER_PRICE_MAP[tier];
    if (!newPriceId) {
      return res.status(400).json({ error: `Unknown tier: ${tier}` });
    }

    const customer = db
      .prepare('SELECT * FROM customers WHERE stripe_customer_id = ?')
      .get(customerId);

    if (!customer || !customer.subscription_id) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const subscription = await stripe.subscriptions.retrieve(customer.subscription_id);
    const itemId = subscription.items.data[0].id;

    const updated = await stripe.subscriptions.update(customer.subscription_id, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations',
    });

    await db.query(
      'UPDATE customers SET tier = ?, subscription_status = ?, updated_at = CURRENT_TIMESTAMP WHERE stripe_customer_id = ?',
      [tier, updated.status, customerId]
    );

    logger.info('Subscription updated', { customerId, tier });
    res.json({ success: true, subscription: { id: updated.id, status: updated.status, tier } });
  } catch (error) {
    logger.error('Error updating subscription', { error: error.message });
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// POST /api/billing/subscription/cancel
// Body: { customerId, immediately }
router.post('/billing/subscription/cancel', async (req, res) => {
  try {
    const { customerId, immediately = false } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId required' });
    }

    const customer = await db.get('SELECT * FROM customers WHERE stripe_customer_id = $1', [customerId]);

    if (!customer || !customer.subscription_id) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    let subscription;
    if (immediately) {
      subscription = await stripe.subscriptions.cancel(customer.subscription_id);
      await db.query(
        'UPDATE customers SET tier = ?, subscription_status = ?, updated_at = CURRENT_TIMESTAMP WHERE stripe_customer_id = ?',
        ['free', 'canceled', customerId]
      );
    } else {
      subscription = await stripe.subscriptions.update(customer.subscription_id, {
        cancel_at_period_end: true,
      });
      await db.query(
        'UPDATE customers SET cancel_at_period_end = true, updated_at = CURRENT_TIMESTAMP WHERE stripe_customer_id = ?',
        [customerId]
      );
    }

    logger.info('Subscription cancelled', { customerId, immediately });
    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    logger.error('Error cancelling subscription', { error: error.message });
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// ──────────────────────────────────────────────
// Stripe Webhooks
// ──────────────────────────────────────────────

const webhookHandler = express.raw({ type: 'application/json' });

async function processWebhookEvent(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn('Webhook signature verification failed', { error: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  logger.info('Stripe webhook received', { type: event.type, id: event.id });

  try {
    await dispatchEvent(event);
  } catch (err) {
    logger.error('Webhook handler error', {
      type: event.type,
      error: err.message,
      stack: err.stack,
    });
    // Return 200 so Stripe does not keep retrying for handler-side bugs
    return res.status(200).json({ received: true, warning: 'Handler error logged' });
  }

  res.json({ received: true });
}

// POST /api/webhooks/stripe  (Railway / production)
router.post('/webhooks/stripe', webhookHandler, processWebhookEvent);
// POST /api/webhook  (backwards compat)
router.post('/webhook', webhookHandler, processWebhookEvent);

async function dispatchEvent(event) {
  switch (event.type) {
    // ── Checkout completed ──
    case 'checkout.session.completed': {
      const session = event.data.object;
      const email = session.metadata?.email || session.customer_email;
      const tier = session.metadata?.tier || 'pro';

      const apiKey = generateApiKey();
      const apiKeyHash = hashApiKey(apiKey);

      const existing = await db.get('SELECT * FROM customers WHERE stripe_customer_id = $1', [session.customer]);

      if (existing) {
        await db.query(
          'UPDATE customers SET tier = ?, subscription_id = ?, subscription_status = ?, updated_at = CURRENT_TIMESTAMP WHERE stripe_customer_id = ?',
          [tier, session.subscription, 'active', session.customer]
        );
      } else {
        await db.query(
          'INSERT INTO customers (stripe_customer_id, email, tier, subscription_id, subscription_status) VALUES (?, ?, ?, ?, ?)',
          [session.customer, email, tier, session.subscription, 'active']
        );
      }

      await db.query('INSERT INTO api_keys (key, key_hash, customer_id, tier) VALUES (?, ?, ?, ?)', [
        apiKey,
        apiKeyHash,
        session.customer,
        tier
      ]);

      logger.info('Checkout completed – API key generated', { customer: session.customer, tier });
      break;
    }

    // ── Subscription created / updated ──
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const tier = sub.metadata?.tier || _tierFromItems(sub);

      await db.query(
        `UPDATE customers SET
          subscription_id = ?,
          subscription_status = ?,
          tier = ?,
          current_period_end = ?,
          cancel_at_period_end = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE stripe_customer_id = ?`,
        [
          sub.id,
          sub.status,
          tier,
          new Date(sub.current_period_end * 1000).toISOString(),
          sub.cancel_at_period_end ? 1 : 0,
          sub.customer
        ]
      );

      logger.info('Subscription synced', { customer: sub.customer, status: sub.status, tier });
      break;
    }

    // ── Subscription deleted ──
    case 'customer.subscription.deleted': {
      const sub = event.data.object;

      await db.query(
        'UPDATE customers SET tier = ?, subscription_status = ?, cancel_at_period_end = 0, updated_at = CURRENT_TIMESTAMP WHERE stripe_customer_id = ?',
        ['free', 'canceled', sub.customer]
      );

      logger.info('Subscription deleted', { customer: sub.customer });
      break;
    }

    // ── Invoice paid ──
    case 'invoice.paid': {
      const invoice = event.data.object;
      await _upsertInvoice(invoice, 'paid');
      logger.info('Invoice paid', { invoiceId: invoice.id, customer: invoice.customer });
      break;
    }

    // ── Invoice payment failed ──
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      await _upsertInvoice(invoice, 'payment_failed');

      await db.query(
        'UPDATE customers SET tier = ?, subscription_status = ?, updated_at = CURRENT_TIMESTAMP WHERE stripe_customer_id = ?',
        ['free', 'past_due', invoice.customer]
      );

      logger.warn('Invoice payment failed – downgraded to free', { customer: invoice.customer });
      break;
    }

    // ── Invoice created / finalized ──
    case 'invoice.created':
    case 'invoice.finalized': {
      const invoice = event.data.object;
      await _upsertInvoice(invoice, invoice.status);
      break;
    }

    default:
      logger.debug('Unhandled Stripe event', { type: event.type });
  }
}

// Persist invoice data locally
async function _upsertInvoice(invoice, status) {
  const existing = await db.get('SELECT id FROM invoices WHERE stripe_invoice_id = $1', [invoice.id]);

  if (existing) {
    await db.query(
      'UPDATE invoices SET status = ?, amount_paid = ?, amount_due = ?, invoice_pdf = ?, hosted_invoice_url = ? WHERE stripe_invoice_id = ?',
      [
        status,
        invoice.amount_paid || 0,
        invoice.amount_due || 0,
        invoice.invoice_pdf || null,
        invoice.hosted_invoice_url || null,
        invoice.id
      ]
    );
  } else {
    await db.query(
      `INSERT INTO invoices
        (stripe_invoice_id, stripe_customer_id, amount_paid, amount_due, currency, status, invoice_pdf, hosted_invoice_url, period_start, period_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoice.id,
        invoice.customer,
        invoice.amount_paid || 0,
        invoice.amount_due || 0,
        invoice.currency || 'usd',
        status,
        invoice.invoice_pdf || null,
        invoice.hosted_invoice_url || null,
        invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
        invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null
      ]
    );
  }
}

// Best-guess tier from subscription items
function _tierFromItems(sub) {
  const priceId = sub.items?.data?.[0]?.price?.id;
  if (!priceId) return 'free';
  return 'pro';
}

module.exports = router;
