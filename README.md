# TextForge - Smart Text Utility API

A lightweight REST API providing **23 text transformation utilities** through a single, simple endpoint. Think of it as a Swiss Army knife for text manipulation that developers can use without installing any libraries.

## Features

- **23 Text Transformations**: slugify, camelcase, snakecase, kebabcase, pascalcase, constantcase, sentencecase, titlecase, reverse, countwords, removemultiple, removespecial, extractemails, extracturls, extractnumbers, truncate, leet, morse, base64encode, base64decode, hash, random, palindromecheck
- **Chained Transformations**: Combine multiple transformations in a single request
- **Batch Processing**: Transform multiple texts in one request
- **Preview Mode**: See all transformations at once
- **Presets**: Pre-configured transformation combinations
- **Rate Limiting**: 1000 req/day (free) / 50,000 req/day (pro)
- **Caching**: Redis-backed with in-memory fallback
- **Webhook Support**: POST results to a URL after processing
- **CORS**: Enabled for all origins
- **API Key System**: Optional authentication for tiered rate limits
- **Stripe Integration**: Automated Pro tier activation and API key generation
- **Web Portal**: Next.js dashboard for billing, key management, and usage stats

## Installation

```bash
# Clone or navigate to the project directory
cd textforge

# Install dependencies
npm install

# Start the server
npm start

# Or in development mode with auto-reload
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port to run the server on |
| `REDIS_URL` | `null` | Redis connection URL (optional, for caching) |
| `NODE_ENV` | `development` | Environment (development/production) |
| `STRIPE_SECRET_KEY` | - | Stripe secret key for payment processing |
| `STRIPE_WEBHOOK_SECRET` | - | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | - | Stripe subscription price ID |
| `BASE_URL` | `http://localhost:3000` | Base URL for redirects |

## Stripe Payment Integration

TextForge now includes Stripe integration for automated Pro tier activation:

### Setup

1. **Create a Stripe account** at [stripe.com](https://stripe.com)
2. **Create a subscription product** in the Stripe dashboard
3. **Get your API keys** from the Stripe dashboard
4. **Configure environment variables** (see above)
5. **Set up webhook** in Stripe dashboard pointing to `https://yourdomain.com/api/webhook`

### Web Portal

The Next.js dashboard provides:
- **Billing page** (`/billing`) - Upgrade to Pro plan
- **Dashboard page** (`/dashboard`) - View usage stats and manage API keys
- **Keys page** (`/keys`) - List and manage your API keys

### Running the Dashboard

```bash
cd textforge-dashboard
npm install
npm run dev
```

The dashboard will be available at `http://localhost:3001` (or whatever port Next.js uses).

### API Key Management

- Pro API keys start with `tf_pro_`
- Keys are stored in SQLite database (`data/textforge.db`)
- Webhook automatically generates keys on successful payment
- Keys can be regenerated or revoked from the dashboard

### Rate Limits by Tier

| Tier | Limit | Key Required |
|------|-------|-------------|
| Free | 1,000 requests/day | No |
| Pro | 50,000 requests/day | Yes (`tf_pro_...`) |

## API Documentation

### Base URL

```
http://localhost:3000
```

### Endpoints

#### 1. GET /transform

Single transformation via query parameters.

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `text` | Yes | The text to transform |
| `action` | Yes | Transformation type (see list below) |
| `actions` | No | Comma-separated list for chaining |
| `preview` | No | Set to `true` to return all transformations |
| `preset` | No | `url`, `human`, or `clean` |
| `limit` | No | Limit length (for truncate) |
| `length` | No | Length (for random) |
| `type` | No | Type (for random: `alnum`, `alpha`, `numeric`, `hex`) |
| `webhook` | No | URL to POST result to |

**Examples:**

```bash
# Slugify
curl "http://localhost:3000/transform?text=Hello%20World!&action=slugify"

# Reverse
curl "http://localhost:3000/transform?text=Hello&action=reverse"

# Count words
curl "http://localhost:3000/transform?text=Hello%20World%20test&action=countwords"

# Chained transformations
curl "http://localhost:3000/transform?text=Hello%20World!&actions=slugify,reverse"

# Preview mode (all transformations)
curl "http://localhost:3000/transform?text=Hello%20World!&preview=true"

# Preset: URL-friendly
curl "http://localhost:3000/transform?text=Hello%20World!&preset=url"

# Truncate
curl "http://localhost:3000/transform?text=Hello%20World!&action=truncate&limit=5"

# Random string
curl "http://localhost:3000/transform?text=&action=random&length=10&type=alnum"
```

#### 2. POST /transform

Single transformation via JSON body.

**Request Body:**

```json
{
  "text": "Hello World!",
  "action": "slugify",
  "actions": ["slugify", "reverse"],
  "preview": false,
  "preset": "url",
  "limit": 10,
  "length": 10,
  "type": "alnum"
}
```

**Examples:**

```bash
# Single transformation
curl -X POST http://localhost:3000/transform \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World!", "action": "slugify"}'

# Chained
curl -X POST http://localhost:3000/transform \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World!", "actions": ["slugify", "reverse"]}'

# Preview
curl -X POST http://localhost:3000/transform \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World!", "preview": true}'
```

#### 3. POST /batch

Batch processing - transform multiple texts in one request.

**Request Body:**

```json
{
  "items": ["Hello World", "Foo Bar", "Test Case"],
  "action": "slugify",
  "webhook": "https://example.com/webhook"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/batch \
  -H "Content-Type: application/json" \
  -d '{
    "items": ["Hello World", "Foo Bar", "Test Case"],
    "action": "slugify"
  }'
```

#### 4. GET /health

Health check endpoint.

```bash
curl http://localhost:3000/health
```

**Response:**

```json
{
  "success": true,
  "status": "healthy",
  "uptime_seconds": 3600,
  "cache": {
    "redisAvailable": true,
    "memoryCacheSize": 42,
    "maxCacheSize": 1000
  },
  "version": "1.0.0"
}
```

#### 5. GET /stats

API statistics.

```bash
curl http://localhost:3000/stats
```

**Response:**

```json
{
  "success": true,
  "stats": {
    "totalRequests": 1523,
    "totalTransformations": 1200,
    "topActions": [
      { "action": "slugify", "count": 450 },
      { "action": "camelcase", "count": 200 }
    ],
    "rateLimit": {
      "totalEntries": 1,
      "entries": [...]
    },
    "cache": { ... },
    "uptime_seconds": 3600
  }
}
```

## Available Transformations

| # | Action | Input | Output |
|---|--------|-------|--------|
| 1 | `slugify` | `"Hello World!"` | `"hello-world"` |
| 2 | `camelcase` | `"user_profile_data"` | `"userProfileData"` |
| 3 | `snakecase` | `"userProfileData"` | `"user_profile_data"` |
| 4 | `kebabcase` | `"userProfileData"` | `"user-profile-data"` |
| 5 | `pascalcase` | `"hello world"` | `"HelloWorld"` |
| 6 | `constantcase` | `"hello world"` | `"HELLO_WORLD"` |
| 7 | `sentencecase` | `"hello WORLD"` | `"Hello world"` |
| 8 | `titlecase` | `"the quick brown fox"` | `"The Quick Brown Fox"` |
| 9 | `reverse` | `"hello"` | `"olleh"` |
| 10 | `countwords` | `"Hello world test"` | `{ words: 3, chars: 17, spaces: 2, sentences: 0 }` |
| 11 | `removemultiple` | `"hello   world"` | `"hello world"` |
| 12 | `removespecial` | `"Hello, World! 123"` | `"Hello World 123"` |
| 13 | `extractemails` | `"Contact: a@b.com and c@d.com"` | `["a@b.com", "c@d.com"]` |
| 14 | `extracturls` | `"Visit https://example.com"` | `["https://example.com"]` |
| 15 | `extractnumbers` | `"I have 42 cats and 3 dogs"` | `[42, 3]` |
| 16 | `truncate` | `"Hello World"` + limit=5 | `"Hello..."` |
| 17 | `leet` | `"hello"` | `"h3ll0"` |
| 18 | `morse` | `"SOS"` | `"... --- ..."` |
| 19 | `base64encode` | `"hello"` | `"aGVsbG8="` |
| 20 | `base64decode` | `"aGVsbG8="` | `"hello"` |
| 21 | `hash` | `"hello"` | `"2cf24dba5..."` (SHA-256) |
| 22 | `random` | (length=10, type=alnum) | `"aB3xY9zK2m"` |
| 23 | `palindromecheck` | `"A man a plan a canal Panama"` | `{ palindrome: true, normalized: "amanaplanacanalpanama" }` |

## Presets

| Preset | Transformations | Use Case |
|--------|----------------|----------|
| `url` | slugify → removespecial → kebabcase | URL-friendly strings |
| `human` | sentencecase → removespecial | Readable text |
| `clean` | removemultiple → removespecial | Clean text input |

## Chaining Example

Transform a string through multiple steps:

```bash
# "Hello World!" → "hello-world" → "dlrow-olleh" → "dlrow-ol"
curl "http://localhost:3000/transform?text=Hello%20World!&actions=slugify,reverse,truncate,4"
```

## Rate Limiting

| Tier | Limit | How to Access |
|------|-------|---------------|
| Free | 1,000 requests/day | No API key needed |
| Pro | 50,000 requests/day | Send `X-API-Key: tf_pro_your-key` |

**Rate Limit Headers:**
- `X-RateLimit-Limit`: Maximum requests per day
- `X-RateLimit-Remaining`: Remaining requests
- `Retry-After`: Seconds to wait (when rate limited)

When rate limited, you'll receive a `429 Too Many Requests` response.

## API Key System

Include an API key in the request header for higher rate limits:

```bash
curl -H "X-API-Key: tf_pro_mykey123" http://localhost:3000/transform?text=Hello&action=slugify
```

- Free keys (no prefix): 1,000/day
- Pro keys (prefix `tf_pro_`): 50,000/day

## Postman / Insomnia Collection

### Environment Variables
```
baseUrl: http://localhost:3000
apiKey: (optional)
```

### Requests

**1. Slugify (GET)**
```
GET {{baseUrl}}/transform?text=Hello%20World!&action=slugify
```

**2. Slugify (POST)**
```
POST {{baseUrl}}/transform
Content-Type: application/json

{
  "text": "Hello World!",
  "action": "slugify"
}
```

**3. Chain Transformations4. Preview Mode
```
GET {{baseUrl}}/transform?text=Hello%20World!&preview=true
```

**5. Batch Processing**
```
POST {{baseUrl}}/batch
Content-Type: application/json

{
  "items": ["Hello World", "Foo Bar", "Test Case"],
  "action": "slugify"
}
```

**6. Preset**
```
GET {{baseUrl}}/transform?text=Hello%20World!&preset=url
```

**7. Morse Code**
```
GET {{baseUrl}}/transform?text=SOS&action=morse
```

**8. Base64 Encode**
```
GET {{baseUrl}}/transform?text=Hello%20World&action=base64encode
```

**9. Base64 Decode**
```
GET {{baseUrl}}/transform?text=SGVsbG8lMjBXb3JsZA==&action=base64decode
```

**10. Count Words**
```
GET {{baseUrl}}/transform?text=Hello%20world%20test&action=countwords
```

**11. Leet Speak**
```
GET {{baseUrl}}/transform?text=hello%20world&action=leet
```

**12. Palindrome Check**
```
GET {{baseUrl}}/transform?text=A%20man%20a%20plan%20a%20canal%20Panama&action=palindromecheck
```

**13. Random String**
```
GET {{baseUrl}}/transform?text=&action=random&length=16&type=alnum
```

**14. Health Check**
```
GET {{baseUrl}}/health
```

**15. Stats**
```
GET {{baseUrl}}/stats
```

### With API Key (Insomnia)
```
Headers:
  X-API-Key: tf_pro_mykey123
```

## Railway Deployment (Recommended)

Railway is the best hosting platform for TextForge because it provides:
- Persistent containers (no cold starts)
- Built-in Redis (critical for rate limiting)
- No timeout limits
- Easy scaling path

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: TextForge API"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

### Step 2: Connect to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Link to your Railway project
railway link
```

### Step 3: Add Redis Service

In the Railway dashboard:
1. Go to your project
2. Click "Add Service" → "Redis"
3. Copy the connection URL

Or via CLI:
```bash
railway services add redis
```

### Step 4: Set Environment Variables

```bash
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set REDIS_URL=<your-redis-url-from-step-3>
```

### Step 5: Deploy

```bash
railway up
```

### Alternative: Deploy via GitHub

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your TextForge repository
5. Add the Redis service and environment variables
6. Railway will auto-deploy on every push

### Railway Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Set production mode |
| `PORT` | `3000` | Railway sets this automatically |
| `REDIS_URL` | `redis://...` | Railway Redis connection URL |

### Railway Pricing

- **Free tier**: $5/month credit (usually sufficient for low-medium traffic)
- **Pay as you go**: After free credit, you pay for compute time
- **Estimated cost**: $0-10/month for moderate usage

## Docker Deployment

### Using Docker Compose

```bash
# Start with Redis
docker-compose up -d

# Or with custom port
PORT=8080 docker-compose up -d
```

### Using Docker Only

```bash
# Build the image
docker build -t textforge .

# Run without Redis
docker run -p 3000:3000 textforge

# Run with Redis
docker run -p 3000:3000 -e REDIS_URL=redis://host.docker.io:6379 textforge
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Missing required parameter: text",
  "status": 400
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "status": 429,
  "retryAfter": 3600
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Endpoint not found: GET /unknown",
  "status": 404
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "status": 500
}
```

## Project Structure

```
textforge/
├── app.js              # Main Express server with routes
├── transformations.js  # All 23 transformation functions
├── rateLimiter.js      # Rate limiting middleware
├── cache.js            # Redis cache wrapper with fallback
├── db.js               # SQLite database module
├── routes/
│   └── stripe.js       # Stripe payment routes
├── data/
│   └── textforge.db    # SQLite database file (auto-created)
├── package.json        # Dependencies and scripts
├── .env.example        # Environment variables template
├── README.md           # This file
└── docker-compose.yml  # Docker compose for Redis + App

textforge-dashboard/    # Next.js web portal
├── app/
│   ├── billing/        # Billing page
│   ├── dashboard/      # Dashboard page
│   ├── keys/           # API keys management
│   └── docs/           # Documentation
├── components/         # Reusable components
└── lib/                # Utility functions
```

## Testing

```bash
# Test a transformation
curl "http://localhost:3000/transform?text=Hello%20World!&action=slugify"

# Test batch
curl -X POST http://localhost:3000/batch \
  -H "Content-Type: application/json" \
  -d '{"items": ["Hello", "World"], "action": "reverse"}'

# Test preview
curl "http://localhost:3000/transform?text=Hello%20World!&preview=true"

# Check health
curl http://localhost:3000/health

# Check stats
curl http://localhost:3000/stats
```

## License

MIT
