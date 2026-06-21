# TextForge – Stripe Configuration Guide

This guide covers everything you need to configure Stripe for TextForge.

---

## 1. Create Products & Prices

### Pro Plan – $29 / month

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products) and click **+ Add product**.
2. Fill in:
   - **Name**: TextForge Pro
   - **Description**: 50,000 requests/day, webhooks, analytics
3. Under **Pricing**, click **+ Add a price**:
   - Pricing model: **Standard pricing**
   - Price: `$29.00` USD
   - Billing period: **Monthly**
4. Click **Save product**.
5. Copy the **Price ID** (e.g. `price_1ABC...`) and save it as `STRIPE_PRO_PRICE_ID`.

### Enterprise Plan – $99 / month

Repeat the steps above with:
- **Name**: TextForge Enterprise
- Price: `$99.00` USD / monthly
- Save the Price ID as `STRIPE_ENTERPRISE_PRICE_ID`.

---

## 2. Get API Keys

1. Go to [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys).
2. Copy the **Secret key** (`sk_test_...` for test, `sk_live_...` for production) and set it as `STRIPE_SECRET_KEY`.

> Keep secret keys out of version control. Use environment variables only.

---

## 3. Configure Webhook Endpoint

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks) and click **+ Add endpoint**.
2. **Endpoint URL**:
   ```
   https://your-domain.com/api/webhooks/stripe
   ```
   For local testing, use the [Stripe CLI](https://stripe.com/docs/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
3. **Events to send** – select all of the following:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.created`
   - `invoice.finalized`
   - `invoice.paid`
   - `invoice.payment_failed`
4. After saving, click **Reveal** next to the signing secret and set it as `STRIPE_WEBHOOK_SECRET`.

---

## 4. Enable Customer Portal

1. Go to [Stripe Dashboard → Customer Portal](https://dashboard.stripe.com/settings/billing/portal).
2. Enable the portal and configure:
   - ✅ Allow customers to update payment methods
   - ✅ Allow customers to view invoice history
   - ✅ Allow customers to cancel subscriptions
   - ✅ Allow customers to update subscriptions (upgrade / downgrade)
3. Set the **Default return URL** to `https://your-domain.com/billing`.
4. Save settings.

---

## 5. Test Mode vs Production

| | Test Mode | Production |
|---|---|---|
| Keys | `sk_test_...` / `pk_test_...` | `sk_live_...` / `pk_live_...` |
| Charges | No real money | Real money |
| Webhooks | Use Stripe CLI or test endpoint | Production endpoint |
| Test cards | `4242 4242 4242 4242` | Real cards |

### Useful test cards

| Card number | Scenario |
|---|---|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Card declined |
| `4000 0025 0000 3155` | 3D Secure required |

Use any future expiry date and any 3-digit CVC.

---

## 6. Local Development with Stripe CLI

```bash
# Install CLI
brew install stripe/stripe-cli/stripe   # macOS
# or download from https://github.com/stripe/stripe-cli/releases

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# The CLI prints a webhook signing secret – set it as STRIPE_WEBHOOK_SECRET
```

---

## 7. Environment Variables Summary

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...
BASE_URL=http://localhost:3000   # change to your production URL
```
