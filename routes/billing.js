const express = require('express');
const Stripe = require('stripe');
const db = require('../db');
const logger = require('../logger');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// POST /billing/checkout - create Stripe checkout session
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ success: false, error: 'Payment processing not configured' });
    }

    const { plan = 'pro' } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let stripeCustomerId = user.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: String(user.id) }
      });
      stripeCustomerId = customer.id;
      db.prepare('UPDATE users SET stripe_customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(stripeCustomerId, user.id);
    }

    const priceId = plan === 'enterprise'
      ? process.env.STRIPE_ENTERPRISE_PRICE_ID
      : process.env.STRIPE_PRO_PRICE_ID || process.env.STRIPE_PRICE_ID;

    if (!priceId) {
      return res.status(503).json({ success: false, error: 'Plan price not configured' });
    }

    const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_DOMAIN
      ? `https://${process.env.NEXT_PUBLIC_DOMAIN}`
      : 'http://localhost:3001';

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${baseUrl}/billing?success=true`,
      cancel_url: `${baseUrl}/billing?canceled=true`,
      metadata: { userId: String(user.id), plan }
    });

    res.json({ success: true, sessionId: session.id, url: session.url });
  } catch (err) {
    logger.error('Create checkout session error', err);
    res.status(500).json({ success: false, error: 'Failed to create checkout session' });
  }
});

// POST /billing/portal - create Stripe customer portal session
router.post('/portal', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ success: false, error: 'Payment processing not configured' });
    }

    const user = db.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').get(req.user.id);
    if (!user || !user.stripe_customer_id) {
      return res.status(400).json({ success: false, error: 'No billing account found. Please subscribe first.' });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${baseUrl}/billing`
    });

    res.json({ success: true, url: session.url });
  } catch (err) {
    logger.error('Create portal session error', err);
    res.status(500).json({ success: false, error: 'Failed to create billing portal session' });
  }
});

// GET /billing/subscription - get current subscription
router.get('/subscription', requireAuth, (req, res) => {
  try {
    const sub = db.prepare(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(req.user.id);

    const user = db.prepare('SELECT tier FROM users WHERE id = ?').get(req.user.id);

    res.json({
      success: true,
      subscription: sub || null,
      tier: user ? user.tier : 'free'
    });
  } catch (err) {
    logger.error('Get subscription error', err);
    res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
  }
});

// POST /billing/cancel - cancel subscription at period end
router.post('/cancel', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ success: false, error: 'Payment processing not configured' });
    }

    const sub = db.prepare(
      'SELECT * FROM subscriptions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1'
    ).get(req.user.id, 'active');

    if (!sub || !sub.stripe_subscription_id) {
      return res.status(400).json({ success: false, error: 'No active subscription found' });
    }

    await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });

    db.prepare(
      'UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(sub.id);

    logger.info('Subscription cancelled at period end', { userId: req.user.id });
    res.json({ success: true, message: 'Subscription will cancel at end of billing period' });
  } catch (err) {
    logger.error('Cancel subscription error', err);
    res.status(500).json({ success: false, error: 'Failed to cancel subscription' });
  }
});

// GET /billing/invoices - list invoices
router.get('/invoices', requireAuth, (req, res) => {
  try {
    const invoices = db.prepare(
      'SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 24'
    ).all(req.user.id);

    res.json({ success: true, invoices });
  } catch (err) {
    logger.error('Get invoices error', err);
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
});

module.exports = router;
