# TextForge

**The Swiss Army Knife for Text Transformations** — 23 utilities through a single, simple API endpoint.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Backend API](#backend-api)
- [Dashboard (Frontend)](#dashboard-frontend)
- [Authentication](#authentication)
- [Stripe Payments](#stripe-payments)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [API Reference](#api-reference)

---

## Overview

TextForge consists of two parts:

| Component | Tech Stack | Directory |
|-----------|-----------|-----------|
| **Backend API** | Express.js, SQLite, Stripe | `/` (root) |
| **Dashboard** | Next.js 14, TailwindCSS, TypeScript | `textforge-dashboard/` |

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/M0N0S0DIUM/Textforge.git
cd Textforge

# Backend
npm install

# Dashboard
cd textforge-dashboard && npm install && cd ..
```

### 2. Configure environment

```bash
# Backend
cp .env.example .env
# Fill in STRIPE_SECRET_KEY, JWT_SECRET, etc.

# Dashboard
cp textforge-dashboard/.env.local.example textforge-dashboard/.env.local
# Fill in NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

### 3. Run locally

```bash
# Terminal 1 — Backend API on :3000
npm run dev

# Terminal 2 — Dashboard on :3001
cd textforge-dashboard && npm run dev
```

---

## Backend API

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/transform` | Single transformation |
| POST | `/batch` | Batch processing |
| GET | `/health` | Health check |
| GET | `/stats` | API statistics |
| POST | `/auth/signup` | Register a user |
| POST | `/auth/login` | Login and get JWT |
| GET | `/auth/me` | Get current user |
| PUT | `/auth/profile` | Update profile / password |
| GET | `/api/keys` | List API keys |
| POST | `/api/keys` | Create an API key |
| DELETE | `/api/keys/:id` | Revoke an API key |
| POST | `/billing/checkout` | Create Stripe checkout session |
| POST | `/billing/portal` | Open Stripe customer portal |
| GET | `/billing/subscription` | Get current subscription |
| POST | `/billing/cancel` | Cancel subscription |
| GET | `/billing/invoices` | List invoices |
| GET | `/users/stats` | User usage statistics |
| GET | `/users/history` | Transformation history |
| POST | `/api/webhook` | Stripe webhook handler |

### Usage example

```bash
# No auth required (free tier, 1000 req/day)
curl "https://api.textforge.co/transform?text=Hello+World&action=slugify"

# Pro tier — pass API key in header
curl -H "X-API-Key: tf_pro_YOUR_KEY" "https://api.textforge.co/transform?text=Hello+World&action=camelcase"
```

---

## Dashboard (Frontend)

| Page | Path | Auth Required |
|------|------|--------------|
| Landing | `/` | No |
| Documentation | `/docs` | No |
| API Playground | `/playground` | No |
| Login | `/login` | No |
| Sign Up | `/signup` | No |
| Dashboard | `/dashboard` | Yes |
| API Keys | `/keys` | Yes |
| Billing | `/billing` | Yes |
| Settings | `/settings` | Yes |

---

## Authentication

TextForge uses **JWT tokens** for dashboard authentication. API requests use **API keys** via the `X-API-Key` header.

### Sign up

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword","name":"Jane"}'
```

Response includes a `token` and `user` object. Store the token in `localStorage` under `tf_token`.

---

## Stripe Payments

### Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Create a **Product** with a monthly price (e.g. $29/month for Pro)
3. Copy the `price_...` ID to `STRIPE_PRO_PRICE_ID` in `.env`
4. Set up a webhook endpoint pointing to `https://your-api.com/api/webhook`
5. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### Webhook events handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Upgrade user to Pro, provision API key |
| `customer.subscription.updated` | Sync subscription status |
| `customer.subscription.deleted` | Downgrade user to Free |
| `invoice.payment_succeeded` | Record invoice |
| `invoice.payment_failed` | Downgrade user to Free |

### Test locally with Stripe CLI

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

---

## Environment Variables

### Backend (`/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | `development` or `production` |
| `JWT_SECRET` | **Yes** | Secret for signing JWT tokens |
| `API_KEY_SECRET` | No | HMAC secret for API key hashing |
| `REDIS_URL` | No | Redis connection URL (optional caching) |
| `STRIPE_SECRET_KEY` | **Yes** | Stripe secret key (`sk_...`) |
| `STRIPE_WEBHOOK_SECRET` | **Yes** | Stripe webhook signing secret (`whsec_...`) |
| `STRIPE_PRO_PRICE_ID` | **Yes** | Stripe price ID for Pro plan |
| `STRIPE_ENTERPRISE_PRICE_ID` | No | Stripe price ID for Enterprise plan |
| `BASE_URL` | No | Backend base URL for Stripe redirects |

### Dashboard (`/textforge-dashboard/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | No | Backend URL (default: `http://localhost:3000`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **Yes** | Stripe publishable key (`pk_...`) |
| `NEXT_PUBLIC_DOMAIN` | No | Public domain for meta tags |

---

## Deployment

### Backend (Railway / Render / Fly.io)

```bash
# Set all environment variables in your platform dashboard
# Then deploy with:
npm start
```

The `railway.json` and `Dockerfile` are pre-configured for Railway.

### Dashboard (Vercel)

```bash
cd textforge-dashboard
vercel deploy
# Set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in Vercel dashboard
```

---

## API Reference

### Transformations

| Action | Description | Example Input | Example Output |
|--------|-------------|---------------|----------------|
| `slugify` | URL-friendly slug | `"Hello World!"` | `"hello-world"` |
| `camelcase` | camelCase | `"user_profile"` | `"userProfile"` |
| `snakecase` | snake_case | `"userProfile"` | `"user_profile"` |
| `kebabcase` | kebab-case | `"userProfile"` | `"user-profile"` |
| `pascalcase` | PascalCase | `"hello world"` | `"HelloWorld"` |
| `constantcase` | CONSTANT_CASE | `"hello world"` | `"HELLO_WORLD"` |
| `sentencecase` | Sentence case | `"hello WORLD"` | `"Hello world"` |
| `titlecase` | Title Case | `"the quick fox"` | `"The Quick Fox"` |
| `reverse` | Reverse string | `"hello"` | `"olleh"` |
| `countwords` | Word/char count | `"hello world"` | `{words:2,...}` |
| `removemultiple` | Remove extra spaces | `"hello   world"` | `"hello world"` |
| `removespecial` | Remove special chars | `"Hello, World!"` | `"Hello World"` |
| `extractemails` | Extract emails | `"hi a@b.com"` | `["a@b.com"]` |
| `extracturls` | Extract URLs | `"see https://x.com"` | `["https://x.com"]` |
| `extractnumbers` | Extract numbers | `"42 cats"` | `[42]` |
| `truncate` | Truncate text | `"Hello World" + limit=5` | `"Hello..."` |
| `leet` | Leet speak | `"hello"` | `"h3ll0"` |
| `morse` | Morse code | `"SOS"` | `"... --- ..."` |
| `base64encode` | Base64 encode | `"hello"` | `"aGVsbG8="` |
| `base64decode` | Base64 decode | `"aGVsbG8="` | `"hello"` |
| `hash` | SHA-256 hash | `"hello"` | `"2cf24dba..."` |
| `random` | Random string | `length=10` | `"aB3xY9zK2m"` |
| `palindromecheck` | Palindrome check | `"racecar"` | `{palindrome:true}` |

### Rate Limits

| Tier | Limit | Auth |
|------|-------|------|
| Free | 1,000 req/day | No key needed |
| Pro | 50,000 req/day | `X-API-Key: tf_pro_...` |
