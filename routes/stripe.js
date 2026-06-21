const express = require('express');
const Stripe = require('stripe');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Generate a random API key with tf_pro_ prefix
function generateApiKey() {
  const randomPart = crypto.randomBytes(16).toString('hex');
  return `tf_pro_${randomPart}`;
}

// Create checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { email, customerId } = req.body;

    // Create or retrieve customer
    let customer;
    if (customerId) {
      customer = await stripe.customers.retrieve(customerId);
    } else {
      customer = await stripe.customers.create({ email });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/billing?success=true`,
      cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/billing?canceled=true`,
      metadata: {
        email: email || customer.email,
      },
    });

    res.json({ sessionId: session.id, customerId: customer.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Handle Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const email = session.metadata?.email || session.customer_email;

      // Generate new API key
      const apiKey = generateApiKey();

      // Insert or update customer
      const existingCustomer = db.prepare('SELECT * FROM customers WHERE stripe_customer_id = ?').get(session.customer);
      
      if (existingCustomer) {
        db.prepare('UPDATE customers SET tier = ?, updated_at = CURRENT_TIMESTAMP WHERE stripe_customer_id = ?').run('pro', session.customer);
      } else {
        db.prepare('INSERT INTO customers (stripe_customer_id, email, tier) VALUES (?, ?, ?)').run(session.customer, email, 'pro');
      }

      // Insert API key
      db.prepare('INSERT INTO api_keys (key, customer_id, tier) VALUES (?, ?, ?)').run(apiKey, session.customer, 'pro');

      console.log(`Generated new API key for customer ${session.customer}`);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const customerId = invoice.customer;

      // Downgrade customer
      db.prepare('UPDATE customers SET tier = ?, updated_at = CURRENT_TIMESTAMP WHERE stripe_customer_id = ?').run('free', customerId);

      console.log(`Payment failed for customer ${customerId}, downgraded to free`);
      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;
