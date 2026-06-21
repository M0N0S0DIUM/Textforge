# TextForge – Railway Deployment Guide

This guide walks you through deploying TextForge on [Railway](https://railway.app) with PostgreSQL (or SQLite), Redis, and full Stripe webhook integration.

---

## Prerequisites

- A [Railway](https://railway.app) account
- A [Stripe](https://stripe.com) account (see [STRIPE_SETUP.md](./STRIPE_SETUP.md))
- Your repository pushed to GitHub

---

## 1. Create a New Railway Project

1. Go to [railway.app/new](https://railway.app/new) and click **Deploy from GitHub repo**.
2. Authorise Railway to access your GitHub account and select the `Textforge` repository.
3. Railway will detect the `Dockerfile` and begin building automatically.

---

## 2. Add a Redis Service

1. Inside your Railway project click **+ New** → **Database** → **Add Redis**.
2. Railway will inject the `REDIS_URL` environment variable automatically.

> **Note:** If you skip Redis, TextForge falls back to in-memory cache and in-memory rate limiting. That is only appropriate for local development or single-instance deployments because limits are not shared between replicas.

---

## 3. Configure Environment Variables

In the Railway dashboard open your service → **Variables** tab and add:

| Variable | Example value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production optimisations |
| `PORT` | `3000` | (Railway usually sets this automatically) |
| `BASE_URL` | `https://your-app.up.railway.app` | Public URL used in Stripe redirect URLs |
| `API_KEY_SECRET` | `32+ random bytes` | **Required.** HMAC secret for API key hashing/validation |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe live secret key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | From the Stripe webhook endpoint |
| `STRIPE_PRO_PRICE_ID` | `price_...` | Pro plan price ID |
| `STRIPE_ENTERPRISE_PRICE_ID` | `price_...` | Enterprise plan price ID |

Copy `.env.example` as a reference for all available variables.

> **Production recommendation:** keep Redis enabled for shared rate limiting, and consider PostgreSQL instead of SQLite if you expect sustained concurrent writes.

---

## 4. Set Up Stripe Webhooks

1. In the [Stripe Dashboard](https://dashboard.stripe.com/webhooks) click **Add endpoint**.
2. Set the URL to:
   ```
   https://your-app.up.railway.app/api/webhooks/stripe
   ```
3. Select these events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.created`
   - `invoice.finalized`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy the **Signing secret** and set it as `STRIPE_WEBHOOK_SECRET` in Railway.

---

## 5. Custom Domain & SSL

1. In the Railway dashboard open your service → **Settings** → **Domains**.
2. Click **Generate Domain** for a free `*.up.railway.app` domain, or **Add Custom Domain** for your own.
3. Railway provisions a free Let's Encrypt certificate automatically.
4. Update `BASE_URL` to your new domain.

---

## 6. Verify the Deployment

```bash
# Health check
curl https://your-app.up.railway.app/health

# Expected response
{
  "success": true,
  "status": "healthy",
  "database": "healthy",
  "uptime_seconds": 42,
  ...
}
```

---

## 7. Monitor Logs

```bash
# Via Railway CLI
railway logs

# Or open the Logs tab in the Railway dashboard
```

---

## 8. Redeploy after Changes

Railway automatically redeploys when you push to the connected branch. You can also trigger a manual redeploy from **Deployments** → **Redeploy**.

---

## Local Development with Docker Compose

```bash
# Start Redis + API
docker compose up

# API is available at http://localhost:3000
# Redis at localhost:6379
```

---

## Billing API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check with DB status |
| `POST` | `/api/create-checkout-session` | Start Stripe Checkout |
| `GET` | `/api/billing/status?customerId=` | Subscription status |
| `GET` | `/api/billing/portal?customerId=` | Redirect to Stripe Customer Portal |
| `POST` | `/api/billing/customer-portal` | Get portal URL as JSON |
| `GET` | `/api/billing/invoices?customerId=` | Invoice history |
| `POST` | `/api/billing/subscription/update` | Change subscription tier |
| `POST` | `/api/billing/subscription/cancel` | Cancel subscription |
| `PUT` | `/api/webhooks/stripe` | Stripe webhook receiver |
