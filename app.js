/**
 * TextForge - Smart Text Utility API
 * 
 * A lightweight REST API providing 28 text transformation utilities
 * through a single, simple endpoint.
 * 
 * Features:
 * - GET and POST support for /transform endpoint
 * - Chained transformations
 * - Batch processing via /batch endpoint
 * - Rate limiting (1000 req/day free, 50000 req/day pro)
 * - Redis caching with in-memory fallback
 * - Preset transformations
 * - Webhook support
 * - CORS support
 * - Health check and stats endpoints
 * 
 * Usage: npm start
 * Environment variables:
 *   - PORT (default: 3000)
 *   - REDIS_URL (optional, for Redis caching)
 */

const express = require('express');
const path = require('path');
const db = require('./db');
const { runMigrations } = require('./db');
const logger = require('./logger');

// Import modules
const {
  slugify, camelcase, snakecase, kebabcase, pascalcase,
  constantcase, sentencecase, titlecase, reverse, countwords,
  removemultiple, removespecial, extractemails, extracturls,
  extractnumbers, truncate, leet, morse, base64encode,
  base64decode, hash, random, palindromecheck,
  htmlencode, htmldecode, markdownplain, unicodenormalize, trimtext,
  validateText, getAvailableActions, getTransformFunction, PRESETS
} = require('./transformations');
const swaggerUi = require('swagger-ui-express');
const yaml = require('yaml');
const openapiSpec = yaml.parse(require('fs').readFileSync('./openapi.yaml', 'utf8'));

const {
  rateLimiterMiddleware,
  getStats: getRateStats,
  startCleanup,
  initRateLimiter
} = require('./rateLimiter');
const cache = require('./cache');
const { initRedis, get: cacheGet, set: cacheSet, clear: cacheClear, generateCacheKey, getStats: getCacheStats } = cache;

// Initialize Express app
const app = express();

app.set('trust proxy', true);
// Configuration
const _parsedPort = parseInt(process.env.PORT, 10);
const PORT = !isNaN(_parsedPort) ? _parsedPort : 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// Request ID Tracking (for debugging and tracing)
// ============================================

/**
 * Generate a unique request ID
 * @returns {string} Unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// ============================================
// Statistics Tracking
// ============================================

// Request counters
const stats = {
  totalRequests: 0,
  totalTransformations: 0,
  actionCounts: {},
  errors: 0,
  startTime: Date.now()
};

// ============================================
// Request ID Tracking Middleware
// ============================================
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || generateRequestId();
  res.set('X-Request-ID', req.id);
  next();
});

// ============================================
// Middleware
// ============================================

// CORS middleware - enable for all origins (client-side usage)
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// JSON body parser with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware with request ID
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const method = req.method;
    const url = req.originalUrl;
    const status = res.statusCode;
    const requestId = req.id || 'unknown';
    
    // Log in development mode
    if (NODE_ENV === 'development') {
      logger.debug(`${method} ${url} - ${status} (${duration}ms) [${requestId}]`);
    }
  });
  
  next();
});

// Rate limiting middleware
app.use(rateLimiterMiddleware());

// Global request counter
app.use((req, res, next) => {
  stats.totalRequests++;
  next();
});

// ============================================
// Helper Functions
// ============================================

/**
 * Validate webhook URL to prevent SSRF attacks
 * @param {string} url - URL to validate
 * @returns {boolean} Whether URL is safe
 */
function isValidWebhookUrl(url) {
  try {
    const parsed = new URL(url);
    
    // Reject private IP ranges and localhost
    const hostname = parsed.hostname;
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i
    ];
    
    for (const pattern of privatePatterns) {
      if (pattern.test(hostname)) {
        return false;
      }
    }
    
    // Only allow http and https
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Execute a single transformation with caching and timing
 * @param {Request} req - Express request object (for logging)
 * @param {string} text - Input text
 * @param {string} action - Transformation action
 * @param {object} params - Additional parameters
 * @returns {Promise<object>} Result object
 */
async function executeTransform(req, text, action, params = {}) {
  const start = Date.now();
  
  // Check cache first
  const cacheKey = generateCacheKey(text, action, params);
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return { ...cached, execution_time_ms: 0, fromCache: true };
  }
  
  // Get the transformation function
  const transformFn = getTransformFunction(action);
  if (!transformFn) {
    return null;
  }
  
  // Execute the transformation
  let result;
  try {
    // Pass params for actions that need them (truncate, random)
    if (action === 'truncate' && params.limit) {
      result = transformFn(text, params.limit);
    } else if (action === 'random' && params.length) {
      result = transformFn(parseInt(params.length, 10), params.type || 'alnum');
    } else {
      result = transformFn(text);
    }
  } catch (err) {
    logger.error('Transformation execution failed', { action, error: err.message, requestId: req.id });
    return { error: `Transformation failed: ${err.message}`, status: 500 };
  }
  
  const executionTime = Date.now() - start;
  
  // Track stats
  stats.totalTransformations++;
  stats.actionCounts[action] = (stats.actionCounts[action] || 0) + 1;
  
  const resultObj = {
    result,
    execution_time_ms: executionTime,
    fromCache: false
  };
  
  // Cache the result (skip caching for random and hash)
  if (action !== 'random' && action !== 'hash') {
    await cacheSet(cacheKey, resultObj);
  }
  
  return resultObj;
}

/**
 * Execute chained transformations
 * @param {Request} req - Express request object (for logging)
 * @param {string} text - Input text
 * @param {string[]} actions - Array of transformation actions
 * @param {object} params - Additional parameters
 * @returns {Promise<object>} Result with all transformations
 */
async function executeChainedTransform(req, text, actions, params = {}) {
  let currentText = text;
  const results = {};
  
  for (const action of actions) {
    const result = await executeTransform(req, currentText, action, params);
    if (result && result.error) {
      return { error: result.error, status: result.status };
    }
    if (result) {
      results[action] = result;
      // Use the result as input for the next transformation
      if (typeof result.result === 'string' || typeof result.result === 'number') {
        currentText = String(result.result);
      }
    }
  }
  
  return { transformations: results };
}

/**
 * Execute all transformations (preview mode)
 * @param {Request} req - Express request object (for logging)
 * @param {string} text - Input text
 * @param {object} params - Additional parameters
 * @returns {Promise<object>} All transformation results
 */
async function executeAllTransforms(req, text, params = {}) {
  const actions = getAvailableActions();
  const results = {};
  
  for (const action of actions) {
    const result = await executeTransform(req, text, action, params);
    if (result && result.result !== undefined && !result.error) {
      results[action] = result.result;
    } else if (result && result.error) {
      results[action] = `Error: ${result.error}`;
    }
  }
  
  return results;
}

/**
 * Send a webhook with the result
 * @param {string} webhookUrl - Webhook URL
 * @param {object} data - Data to send
 */
async function sendWebhook(webhookUrl, data) {
  // Validate webhook URL to prevent SSRF
  if (!isValidWebhookUrl(webhookUrl)) {
    logger.warn('Invalid webhook URL rejected', { url: webhookUrl });
    return;
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    if (!response.ok) {
      logger.warn('Webhook failed with status', { url: webhookUrl, status: response.status });
    }
  } catch (err) {
    logger.warn('Webhook request failed', { url: webhookUrl, error: err.message });
  }
}

const crypto = require('crypto');

/**
 * Log request to request_logs table for analytics
 * @param {Request} req - Express request object
 * @param {object} params - Request parameters
 * @param {number} statusCode - HTTP status code
 * @param {number} latencyMs - Execution time in ms
 * @param {string|null} action - Single action (if applicable)
 * @param {string[]} actions - Array of actions for chaining
 * @param {number} requestSize - Request body size in bytes
 * @param {number} responseSize - Response body size in bytes
 */
async function logRequest(req, { action, actions, text }, statusCode, latencyMs, requestSize, responseSize) {
  try {
    // Get API key hash from header
    const apiKey = req.headers['x-api-key'];
    let apiKeyHash = null;
    
    // Hash IP for privacy (used for anonymous users)
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
    
    if (apiKey) {
      const { hashApiKey } = require('./apiKeys');
      apiKeyHash = hashApiKey(apiKey);
    } else {
      // For anonymous users, use IP hash in api_key_hash column (NOT NULL constraint)
      apiKeyHash = ipHash;
    }

    // Determine primary action for logging
    const primaryAction = action || (actions && actions.length > 0 ? actions[0] : 'preview');

    await db.query(
      `INSERT INTO request_logs 
       (api_key_hash, action, actions, status_code, latency_ms, request_size_bytes, response_size_bytes, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        apiKeyHash,
        primaryAction,
        actions ? JSON.stringify(actions) : null,
        statusCode,
        latencyMs,
        requestSize,
        responseSize,
        ipHash
      ]
    );
  } catch (err) {
    // Don't fail the request if logging fails
    logger.warn('Request logging failed', { error: err.message, stack: err.stack });
  }
}

// Stripe / billing routes (must be mounted before the global JSON parser affects raw bodies)
const stripeRouter = require('./routes/stripe');
app.use('/api', stripeRouter);

// Presets routes
const presetsRouter = require('./routes/presets');
app.use('/api', presetsRouter);

// Analytics routes
const analyticsRouter = require('./routes/analytics').router;
app.use('/api', analyticsRouter);

// Admin routes (testing/development only)
const adminRouter = require('./routes/admin');
app.use('/admin', adminRouter);

// Serve Next.js dashboard static files
const dashboardBuildPath = path.join(__dirname, 'textforge-dashboard', '.next');
const dashboardPublicPath = path.join(__dirname, 'textforge-dashboard', 'public');

// Serve static assets (JS, CSS, images)
app.use('/_next/static', express.static(path.join(dashboardBuildPath, 'static')));
app.use('/_next/data', express.static(path.join(dashboardBuildPath, 'server', 'app')));
app.use('/favicon.ico', express.static(path.join(dashboardPublicPath, 'favicon.ico')));
app.use('/robots.txt', express.static(path.join(dashboardPublicPath, 'robots.txt')));

// Serve Next.js pages via static HTML files
app.use(express.static(dashboardBuildPath));

// ============================================
// Routes
// ============================================

// Root route - HTML landing page for browser users
app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TextForge - Smart Text Utility API</title>
  <meta name="description" content="23 text transformation utilities through a single, simple API. Slugify, camelcase, morse code, and more.">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; }
    .nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #eee; }
    .nav-brand { font-size: 20px; font-weight: 700; color: #3b82f6; text-decoration: none; }
    .nav-links { display: flex; gap: 16px; }
    .nav-links a { color: #555; text-decoration: none; font-size: 14px; }
    .nav-links a:hover { color: #111; }
    .nav-links .btn { background: #3b82f6; color: white; padding: 8px 16px; border-radius: 6px; }
    .nav-links .btn:hover { background: #2563eb; color: white; }
    
    .hero { text-align: center; padding: 80px 24px 60px; background: linear-gradient(to bottom, #fff, #f8fafc); }
    .hero-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: #eff6ff; color: #1d4ed8; border-radius: 999px; font-size: 14px; font-weight: 500; margin-bottom: 24px; }
    .hero-badge .dot { width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; }
    .hero h1 { font-size: 48px; font-weight: 800; line-height: 1.1; margin-bottom: 20px; }
    .hero h1 span { color: #3b82f6; }
    .hero p { font-size: 20px; color: #555; max-width: 600px; margin: 0 auto 32px; line-height: 1.6; }
    .hero-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
    .btn-primary { background: #3b82f6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }
    .btn-primary:hover { background: #2563eb; }
    .btn-secondary { background: white; color: #3b82f6; border: 2px solid #3b82f6; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }
    .btn-secondary:hover { background: #eff6ff; }
    .code-block { background: #1a1a2e; color: #f8f8f8; padding: 16px 24px; border-radius: 8px; font-family: monospace; font-size: 14px; margin-top: 40px; max-width: 700px; margin-left: auto; margin-right: auto; overflow-x: auto; }

    .section { padding: 80px 24px; }
    .section-title { text-align: center; font-size: 32px; font-weight: 700; margin-bottom: 16px; }
    .section-subtitle { text-align: center; color: #555; font-size: 18px; max-width: 600px; margin: 0 auto 48px; }
    
    .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; max-width: 1000px; margin: 0 auto; }
    .feature-card { padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; transition: box-shadow 0.2s; }
    .feature-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .feature-icon { font-size: 24px; margin-bottom: 12px; }
    .feature-card h3 { font-size: 18px; margin-bottom: 8px; }
    .feature-card p { color: #555; font-size: 14px; line-height: 1.6; }

    .pipeline-section { background: #f8fafc; }
    .pipeline-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; max-width: 1000px; margin: 0 auto; align-items: center; }
    .pipeline-code { background: #1a1a2e; color: #f8f8f8; padding: 24px; border-radius: 12px; font-family: monospace; font-size: 13px; overflow-x: auto; line-height: 1.8; }
    .pipeline-steps { display: flex; flex-direction: column; gap: 12px; }
    .pipeline-step { padding: 12px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; display: flex; align-items: center; gap: 12px; }
    .step-num { background: #eff6ff; color: #1d4ed8; padding: 4px 10px; border-radius: 4px; font-weight: 600; font-size: 12px; }
    .step-action { font-family: monospace; font-weight: 600; color: #3b82f6; }

    .transforms-cloud { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; max-width: 800px; margin: 0 auto; }
    .transform-tag { padding: 8px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; font-family: monospace; font-size: 13px; color: #444; }

    .pricing { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 700px; margin: 0 auto; }
    .pricing-card { padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center; }
    .pricing-card.featured { border: 2px solid #3b82f6; position: relative; }
    .pricing-card h3 { font-size: 22px; margin-bottom: 8px; }
    .price { font-size: 48px; font-weight: 800; color: #111; }
    .price span { font-size: 16px; font-weight: 400; color: #888; }
    .pricing-card ul { list-style: none; margin: 24px 0; }
    .pricing-card li { padding: 8px 0; color: #555; font-size: 14px; }
    .cta-btn { display: inline-block; margin-top: 16px; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .cta-btn.primary { background: #3b82f6; color: white; }
    .cta-btn.secondary { background: #f1f5f9; color: #333; }

    .cta-section { background: #3b82f6; text-align: center; padding: 80px 24px; }
    .cta-section h2 { color: white; font-size: 32px; margin-bottom: 16px; }
    .cta-section p { color: rgba(255,255,255,0.8); font-size: 18px; margin-bottom: 32px; }

    .footer { padding: 32px 24px; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 14px; }
    .footer a { color: #3b82f6; text-decoration: none; margin: 0 12px; }

    @media (max-width: 768px) {
      .hero h1 { font-size: 32px; }
      .pipeline-grid, .pricing { grid-template-columns: 1fr; }
      .nav-links { gap: 10px; }
      .nav-links a { font-size: 13px; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <a href="/" class="nav-brand">TextForge</a>
    <div class="nav-links">
      <a href="/docs">Docs</a>
      <a href="/faq">FAQ</a>
      <a href="/playground" class="btn">Playground</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/keys">API Keys</a>
      <a href="/billing" class="btn">Billing</a>
    </div>
  </nav>

  <section class="hero">
    <div class="hero-badge"><span class="dot"></span> Now with 28 text transformations & chaining</div>
    <h1>The Swiss Army Knife for<br><span>Text Transformations</span></h1>
    <p>28 text utilities through a single, simple endpoint. Slugify, camelcase, morse code, base64, HTML encoding, and more. Chain operations with the /v1/run pipeline endpoint.</p>
    <div class="hero-actions">
      <a href="/docs" class="btn-primary">Read the Docs &rarr;</a>
      <a href="/playground" class="btn-secondary">Try Playground</a>
    </div>
    <div class="code-block">curl -X POST https://textforge.co/v1/run -H "Content-Type: application/json" -d '{"input": "Hello World!", "pipeline": ["slugify", "reverse", "base64encode"]}'</div>
  </section>

  <section class="section">
    <h2 class="section-title">Everything You Need</h2>
    <p class="section-subtitle">From URL slugs to Morse code, TextForge has you covered with fast, reliable text transformations.</p>
    <div class="features">
      <div class="feature-card">
        <div class="feature-icon">⚡</div>
        <h3>23 Transformations</h3>
        <p>From slugify to morse code, all text transformations in one API.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🔗</div>
        <h3>Chain Operations</h3>
        <p>Combine multiple transformations in a single request for complex operations.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon"></div>
        <h3>Lightning Fast</h3>
        <p>Optimized for speed with sub-5ms response times for each transformation.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🛡️</div>
        <h3>Rate Limiting</h3>
        <p>Built-in rate limiting with generous free tier to protect your usage.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon"></div>
        <h3>Batch Processing</h3>
        <p>Process up to 100 texts in a single request. Perfect for bulk operations.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🔔</div>
        <h3>Webhook Delivery</h3>
        <p>Get async delivery of results via webhook. Fire-and-forget processing.</p>
      </div>
    </div>
  </section>

  <section class="section pipeline-section">
    <h2 class="section-title">Pipeline Chaining</h2>
    <p class="section-subtitle">Execute multiple transformations in sequence. Each step feeds into the next.</p>
    <div class="pipeline-grid">
      <div>
        <div class="pipeline-code" style="margin-bottom: 16px;">
          <strong style="color: #aaa;">Request</strong><br><br>
          POST /v1/run<br>
          Content-Type: application/json<br><br>
          {<br>
          &nbsp;&nbsp;"input": "Hello World!",<br>
          &nbsp;&nbsp;"pipeline": ["slugify", "reverse", "base64encode"]<br>
          }
        </div>
        <div class="pipeline-code">
          <strong style="color: #aaa;">Response</strong><br><br>
          {<br>
          &nbsp;&nbsp;"success": true,<br>
          &nbsp;&nbsp;"result": "ZGxyb3ctb2xsZWg=",<br>
          &nbsp;&nbsp;"steps": [...]<br>
          }
        </div>
      </div>
      <div class="pipeline-steps">
        <div class="pipeline-step"><span class="step-num">Step 1</span><span class="step-action">slugify</span> → hello-world</div>
        <div class="pipeline-step"><span class="step-num">Step 2</span><span class="step-action">reverse</span> → dlrow-olleh</div>
        <div class="pipeline-step"><span class="step-num">Step 3</span><span class="step-action">base64encode</span> → ZGxyb3ctb2xsZWg=</div>
      </div>
    </div>
  </section>

  <section class="section">
    <h2 class="section-title">23 Transformations</h2>
    <p class="section-subtitle">All available in a single API call</p>
    <div class="transforms-cloud">
      <span class="transform-tag">slugify</span><span class="transform-tag">camelcase</span><span class="transform-tag">snakecase</span><span class="transform-tag">kebabcase</span><span class="transform-tag">pascalcase</span><span class="transform-tag">constantcase</span><span class="transform-tag">sentencecase</span><span class="transform-tag">titlecase</span><span class="transform-tag">reverse</span><span class="transform-tag">countwords</span><span class="transform-tag">removemultiple</span><span class="transform-tag">removespecial</span><span class="transform-tag">extractemails</span><span class="transform-tag">extracturls</span><span class="transform-tag">extractnumbers</span><span class="transform-tag">truncate</span><span class="transform-tag">leet</span><span class="transform-tag">morse</span><span class="transform-tag">base64encode</span><span class="transform-tag">base64decode</span><span class="transform-tag">hash</span><span class="transform-tag">random</span><span class="transform-tag">palindromecheck</span>
    </div>
  </section>

  <section class="section" style="background: #f8fafc;">
    <h2 class="section-title">Simple, Transparent Pricing</h2>
    <p class="section-subtitle">Start free. Upgrade when you need more.</p>
    <div class="pricing">
      <div class="pricing-card">
        <h3>Free</h3>
        <div class="price">$0<span class="price"><span>/month</span></span></div>
        <p style="color: #888; font-size: 14px; margin-top: 8px;">Perfect for testing and small projects</p>
        <ul>
          <li>✓ 1,000 requests/day</li>
          <li>✓ All 23 transformations</li>
          <li>✓ Chaining support</li>
          <li>✓ Community support</li>
        </ul>
        <a href="/dashboard" class="cta-btn secondary">Get Started</a>
      </div>
      <div class="pricing-card">
        <h3>Pro</h3>
        <div class="price">$2.99<span class="price"><span>/month</span></span></div>
        <p style="color: #888; font-size: 14px; margin-top: 8px;">For production applications</p>
        <ul>
          <li>✓ 50,000 requests/day</li>
          <li>✓ Priority support</li>
          <li>✓ Webhook delivery</li>
          <li>✓ Custom presets</li>
          <li>✓ Analytics</li>
        </ul>
        <a href="/billing" class="cta-btn primary">Upgrade to Pro</a>
      </div>
    </div>
  </section>

  <section class="cta-section">
    <h2>Ready to get started?</h2>
    <p>Start with our generous free tier. No credit card required.</p>
    <a href="/dashboard" class="btn-secondary" style="color: #3b82f6; background: white;">Get Your Free API Key &rarr;</a>
  </section>

  <footer class="footer">
    &copy; 2026 TextForge. All rights reserved.
    <a href="/docs">Docs</a>
    <a href="mailto:odderonlab@protonmail.com">Support</a>
  </footer>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
});

app.get('/health', async (req, res) => {
   const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
   const cacheStats = getCacheStats();

   // Use live cache.redisAvailable getter
   const redisAvailable = cache.redisAvailable;
   let redisStatus = redisAvailable ? 'connected' : 'not_configured';

   // Quick database liveness probe
   let dbStatus = 'healthy';
   try {
     await db.get('SELECT 1');
   } catch (err) {
     dbStatus = 'unhealthy';
     logger.error('Database health check failed', { error: err.message });
   }

   // Check if all migrations are applied
   let migrationsStatus = 'completed';
   try {
     const result = await db.query('SELECT COUNT(*) as count FROM schema_migrations');
     if (result.rows.length === 0) {
       migrationsStatus = 'not_started';
     }
   } catch (err) {
     migrationsStatus = 'error';
     logger.warn('Migration status check failed', { error: err.message });
   }

   const status = (dbStatus === 'healthy' && redisStatus !== 'unhealthy') ? 'healthy' : 'degraded';

   res.status(status === 'healthy' ? 200 : 503).json({
     success: status === 'healthy',
     status,
     uptime_seconds: uptime,
     database: dbStatus,
     redis: redisStatus,
     migrations: migrationsStatus,
     cache: {
       ...cacheStats,
       backend: redisAvailable ? 'redis' : 'memory'
     },
     version: '1.0.0',
     requestId: req.id
   });
 });

/**
 * GET /stats - API statistics endpoint
 * Returns request counts and popular actions
 */
app.get('/stats', (req, res) => {
  const rateStats = getRateStats();
  const cacheStats = getCacheStats();
  
  // Get top actions sorted by count
  const topActions = Object.entries(stats.actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([action, count]) => ({ action, count }));
  
  res.json({
    success: true,
    stats: {
      totalRequests: stats.totalRequests,
      totalTransformations: stats.totalTransformations,
      topActions: topActions,
      rateLimit: rateStats,
      cache: cacheStats,
      uptime_seconds: Math.floor((Date.now() - stats.startTime) / 1000)
    }
  });
});

// ============================================
// Dashboard Routes (served from Next.js static build)
// ============================================
const fs = require('fs');
// path already imported at line 25

// Serve dashboard pages if built
const dashboardDir = path.join(__dirname, 'textforge-dashboard', '.next', 'server', 'app');

function serveDashboardPage(req, res, pageName) {
  const htmlPath = path.join(dashboardDir, `${pageName}.html`);
  if (fs.existsSync(htmlPath)) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).sendFile(htmlPath);
  }
  // Fallback if dashboard not built
  return res.redirect('/api-docs');
}

if (fs.existsSync(dashboardDir)) {
  // Serve dashboard index
  app.get('/dashboard', (req, res) => serveDashboardPage(req, res, 'dashboard'));
  // Serve billing page
  app.get('/billing', (req, res) => serveDashboardPage(req, res, 'billing'));
  // Serve keys page
  app.get('/keys', (req, res) => serveDashboardPage(req, res, 'keys'));
  // Serve docs page
  app.get('/docs', (req, res) => serveDashboardPage(req, res, 'docs'));
  // Serve FAQ page
  app.get('/faq', (req, res) => serveDashboardPage(req, res, 'faq'));
  // Serve changelog page
  app.get('/changelog', (req, res) => serveDashboardPage(req, res, 'changelog'));
}

// Always add fallback routes for FAQ and changelog if not built
if (!fs.existsSync(dashboardDir)) {
  // Dashboard pages not built yet - redirect to API docs
  app.get('/dashboard', (req, res) => res.redirect('/api-docs'));
  app.get('/billing', (req, res) => res.redirect('/api-docs'));
  app.get('/keys', (req, res) => res.redirect('/api-docs'));
  app.get('/docs', (req, res) => res.redirect('/api-docs'));
  
  // FAQ page fallback
  app.get('/faq', (req, res) => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FAQ - TextForge</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; }
          h1 { color: #3b82f6; }
          .question { margin-bottom: 16px; }
          .question h3 { font-weight: 600; color: #111; }
          .answer { color: #555; line-height: 1.5; }
          footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 14px; }
          nav { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; }
          nav a { color: #3b82f6; text-decoration: none; }
        </style>
      </head>
      <body>
        <nav>
          <a href="/">TextForge</a>
          <a href="/docs">Docs</a>
        </nav>
        <h1>FAQ</h1>
        <div class="question">
          <h3>What is TextForge?</h3>
          <p class="answer">TextForge provides 28 text transformation utilities through a single API endpoint. Transform text with slugify, camelCase, base64, morse code, HTML encoding, and more.</p>
        </div>
        <div class="question">
          <h3>How do I get an API key?</h3>
          <p class="answer">Sign in to your dashboard and generate an API key. The free tier includes 1,000 requests/day.</p>
        </div>
        <div class="question">
          <h3>What is the rate limit?</h3>
          <p class="answer">Free tier: 1,000 requests/day. Pro tier: 50,000 requests/day.</p>
        </div>
        <div class="question">
          <h3>Can I chain transformations?</h3>
          <p class="answer">Yes! Use the /v1/run endpoint with multiple actions in a single request.</p>
        </div>
        <footer>
          &copy; 2026 TextForge. All rights reserved.
        </footer>
      </body>
      </html>`;
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  });
  
  // Changelog page fallback
  app.get('/changelog', (req, res) => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Changelog - TextForge</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; }
          h1 { color: #3b82f6; }
          .release { margin-bottom: 32px; border-left: 4px solid #3b82f6; padding-left: 16px; }
          .release h2 { font-size: 20px; color: #111; }
          .version { color: #888; font-size: 14px; margin-bottom: 8px; }
          .changes li { color: #555; line-height: 1.6; }
          footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 14px; }
          nav { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; }
          nav a { color: #3b82f6; text-decoration: none; }
        </style>
      </head>
      <body>
        <nav>
          <a href="/">TextForge</a>
          <a href="/docs">Docs</a>
        </nav>
        <h1>Changelog</h1>
        <div class="release">
          <h2>v1.0.0</h2>
          <p class="version">Released: 2025-01-15</p>
          <ul class="changes">
            <li>Initial release with 23 transformations</li>
            <li>API key authentication</li>
            <li>Rate limiting</li>
          </ul>
        </div>
        <div class="release">
          <h2>v0.9.0</h2>
          <p class="version">Released: 2024-12-01</p>
          <ul class="changes">
            <li>Beta testing</li>
            <li>Custom presets (Pro)</li>
            <li>Analytics dashboard</li>
          </ul>
        </div>
        <footer>
          &copy; 2026 TextForge. All rights reserved.
        </footer>
      </body>
      </html>`;
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  });
}

// Playground page
app.get('/playground', (req, res) => {
  const html = `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TextForge Playground</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #111; }
    .nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #eee; background: white; }
    .nav-brand { font-size: 20px; font-weight: 700; color: #3b82f6; text-decoration: none; }
    .nav-links { display: flex; gap: 24px; }
    .nav-links a { color: #555; text-decoration: none; font-size: 14px; }
    .nav-links a:hover { color: #3b82f6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }
    h1 { font-size: 36px; font-weight: 800; margin-bottom: 16px; color: #1e293b; }
    .subtitle { color: #64748b; font-size: 18px; margin-bottom: 32px; }
    
    .playground-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    @media (max-width: 968px) { .playground-grid { grid-template-columns: 1fr; } }
    
    .input-section, .output-section {
      background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .section-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #334155; }
    
    textarea { width: 100%; height: 100px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 16px; font-family: monospace; resize: vertical; }
    textarea:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    
    .controls { margin-top: 20px; }
    .control-row { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
    select { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; min-width: 200px; }
    input[type="text"] { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; min-width: 150px; }
    .checkbox-group { display: flex; gap: 16px; align-items: center; margin-top: 12px; }
    .checkbox-label { display: flex; items-align: center; gap: 8px; cursor: pointer; font-size: 14px; color: #334155; }
    
    .result-box {
      background: #f1f5f9; border-radius: 8px; padding: 16px; min-height: 100px;
      font-family: monospace; white-space: pre-wrap; word-break: break-all; margin-top: 12px;
    }
    .result-row { margin-bottom: 16px; }
    .result-title { font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 4px; }
    .result-value { font-family: monospace; font-size: 14px; color: #1e293b; word-break: break-all; }
    
    .action-btn {
      background: #3b82f6; color: white; padding: 10px 20px; border-radius: 6px;
      font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s;
    }
    .action-btn:hover { background: #2563eb; }
    
    .transformations-list {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; margin-top: 16px;
    }
    .transform-tag {
      padding: 8px 12px; background: #f1f5f9; border-radius: 6px; font-size: 13px;
      color: #475569; cursor: pointer; transition: all 0.2s; text-align: center;
    }
    .transform-tag:hover { background: #e2e8f0; color: #3b82f6; }
    
    .execution-time { font-size: 12px; color: #64748b; margin-top: 8px; font-style: italic; }
    .error { color: #ef4444; }
    
    .section { margin-bottom: 32px; }
    .section h2 { font-size: 24px; font-weight: 700; margin-bottom: 16px; color: #1e293b; }
  </style>
</head>
<body>
  <nav class="nav">
    <a href="/" class="nav-brand">TextForge Playground</a>
    <div class="nav-links">
      <a href="/">Home</a>
      <a href="/docs">Docs</a>
      <a href="/dashboard">Dashboard</a>
    </div>
  </nav>

  <div class="container">
    <h1>TextForge Playground</h1>
    <p class="subtitle">Test all 28 text transformations in real-time</p>
    
    <div class="playground-grid">
      <div class="input-section">
        <div class="section-title">Input Text</div>
        <textarea id="inputText" placeholder="Enter text to transform..."></textarea>
        
        <div class="controls">
          <div class="control-row">
            <select id="transformationSelect"></select>
            <button class="action-btn" onclick="transformSingle()">Transform</button>
            <label class="checkbox-label">
              <input type="checkbox" id="showAllCheckbox" onchange="toggleShowAll()">
              Show All Results
            </label>
          </div>
        </div>
      </div>

      <div class="output-section">
        <div class="section-title">Result</div>
        <div id="singleResult" class="result-box">Results will appear here...</div>
        <div id="executionTime" class="execution-time"></div>
        
        <div class="transformations-list" id="allTransformationsList"></div>
      </div>
    </div>

    <div class="section">
      <h2>Available Transformations</h2>
      <div class="transformations-list" id="transformationTags"></div>
    </div>
  </div>

  <script>
    const transformations = [
      'slugify', 'camelcase', 'snakecase', 'kebabcase', 'pascalcase',
      'constantcase', 'sentencecase', 'titlecase', 'reverse', 'countwords',
      'removemultiple', 'removespecial', 'extractemails', 'extracturls',
      'extractnumbers', 'truncate', 'leet', 'morse', 'base64encode',
      'base64decode', 'hash', 'random', 'palindromecheck',
      'htmlencode', 'htmldecode', 'markdownplain', 'unicodenormalize', 'trimtext'
    ];

    // Populate transformation select dropdown
    const transSelect = document.getElementById('transformationSelect');
    transformations.forEach(trans => {
      const option = document.createElement('option');
      option.value = trans;
      option.textContent = trans;
      transSelect.appendChild(option);
    });

    // Populate transformation tags
    const tagContainer = document.getElementById('transformationTags');
    transformations.forEach(trans => {
      const tag = document.createElement('div');
      tag.className = 'transform-tag';
      tag.textContent = trans;
      tag.onclick = () => {
        transSelect.value = trans;
        if (document.getElementById('inputText').value.trim()) {
          transformSingle();
        }
      };
      tagContainer.appendChild(tag);
    });

    async function transformSingle() {
      const text = document.getElementById('inputText').value.trim();
      const transformation = transSelect.value;
      
      if (!text) {
        alert('Please enter some text to transform');
        return;
      }

      const startTime = Date.now();
      
      try {
        const response = await fetch('/transform', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, action: transformation })
        });

        if (!response.ok) throw new Error('Transform failed');
        
        const data = await response.json();
        const executionTime = Date.now() - startTime;
        
        document.getElementById('singleResult').innerHTML = `<div class="result-row">
          <div class="result-title">Result (${transformation})</div>
          <div class="result-value">${escapeHtml(data.result)}</div>
        </div>
        <div class="execution-time">Execution time: ${executionTime}ms</div>`;
      } catch (error) {
        document.getElementById('singleResult').innerHTML = `<div class="result-row">
          <div class="result-title error">Error</div>
          <div class="result-value error">${escapeHtml(error.message)}</div>
        </div>`;
      }
    }

    function toggleShowAll() {
      const showAll = document.getElementById('showAllCheckbox').checked;
      const inputText = document.getElementById('inputText').value.trim();
      const listContainer = document.getElementById('allTransformationsList');
      
      if (showAll) {
        if (!inputText) {
          alert('Please enter some text to transform');
          document.getElementById('showAllCheckbox').checked = false;
          return;
        }

        Promise.all(transformations.map(async trans => {
          try {
            const response = await fetch('/transform', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: inputText, action: trans })
            });

            if (!response.ok) return { transformation: trans, result: null };
            
            const data = await response.json();
            return { transformation: trans, result: data.result };
          } catch (error) {
            return { transformation: trans, result: null };
          }
        })).then(results => {
          listContainer.innerHTML = results.map(r => `
            <div class="result-row">
              <div class="result-title">${r.transformation}</div>
              <div class="result-value">${r.result ? escapeHtml(String(r.result)) : 'Error'}</div>
            </div>
          `).join('');
        });
      } else {
        listContainer.innerHTML = '';
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
});

// Also serve Next.js static assets
const staticDir = path.join(__dirname, 'textforge-dashboard', '.next', 'static');
if (fs.existsSync(staticDir)) {
  app.use('/_next/static', express.static(staticDir));
}

/**
 * Shared transform request handler used by both GET and POST /transform.
 *
 * @param {object} p              - Normalized request parameters
 * @param {string}  p.text        - Input text (already validated non-empty)
 * @param {string}  [p.action]    - Single transformation action
 * @param {string[]} [p.actions]  - Ordered list of actions for chaining (already split/normalized)
 * @param {boolean} [p.preview]   - Return all transformations when true
 * @param {string}  [p.preset]    - Named preset ('url', 'human', 'clean')
 * @param {*}       [p.limit]     - Truncate limit
 * @param {*}       [p.length]    - Random string length
 * @param {string}  [p.type]      - Random string character set
 * @param {string}  [p.webhook]   - Webhook URL for async result delivery
 * @param {object}  res           - Express response object
 */
async function processTransformRequest(req, { text, action, actions, preview, preset, limit, length, type, webhook }, res) {
  const startTime = Date.now();
  // Validate required parameters
  if (text === undefined || text === null) {
    const executionTime = Date.now() - startTime;
    await logRequest(req, { action: null, actions: null, text: '' }, 400, executionTime, 0, 0);
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: text',
      status: 400
    });
  }

  if (!action && !actions && !preview && !preset) {
    const executionTime = Date.now() - startTime;
    await logRequest(req, { action: null, actions: null, text: '' }, 400, executionTime, 0, 0);
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: action, actions, preview, or preset',
      status: 400
    });
  }

  // Validate text length
  const validation = validateText(text);
  if (!validation.valid) {
    const executionTime = Date.now() - startTime;
    await logRequest(req, { action: null, actions: null, text: text.substring(0, 100) }, 400, executionTime, text.length, 0);
    return res.status(400).json({
      success: false,
      error: validation.error,
      status: 400
    });
  }

  // Handle preview mode - return all transformations
  if (preview) {
  const params = { limit, length, type };
  const transformations = await executeAllTransforms(req, text, params);
    const executionTime = Date.now() - startTime;

    if (webhook) {
      sendWebhook(webhook, { original: text, transformations, execution_time_ms: executionTime });
    }

    const responseBody = {
      success: true,
      original: text,
      transformations,
      execution_time_ms: executionTime
    };
    await logRequest(req, { action: 'preview', actions: null, text }, 200, executionTime, text.length, JSON.stringify(responseBody).length);

    return res.json(responseBody);
  }

  // Handle presets (built-in and custom user presets)
  let presetActions = null;
  let isCustomPreset = false;

  if (preset && PRESETS[preset]) {
    presetActions = PRESETS[preset];
  } else if (preset) {
    // Check for custom user preset
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      const { hashApiKey } = require('./apiKeys');
      const apiKeyHash = hashApiKey(apiKey);
      
      // Get customer_id from api_key
      const keyRecord = await db.get(
        'SELECT customer_id FROM api_keys WHERE key_hash = $1',
        [apiKeyHash]
      );
      
      if (keyRecord?.customer_id) {
        const customPreset = await db.get(
          'SELECT actions FROM user_presets WHERE customer_id = $1 AND name = $2',
          [keyRecord.customer_id, preset]
        );
        
        if (customPreset) {
          presetActions = customPreset.actions;
          isCustomPreset = true;
        }
      }
    }
  }

  if (presetActions) {
    const params = { limit, length, type };
    const result = await executeChainedTransform(req, text, presetActions, params);
    const executionTime = Date.now() - startTime;

    if (result.error) {
      await logRequest(req, { action: preset, actions: presetActions, text }, 400, executionTime, text.length, 0);
      return res.status(400).json({ success: false, error: result.error, status: result.status });
    }

    if (webhook) {
      sendWebhook(webhook, { original: text, preset, result, execution_time_ms: executionTime });
    }

    const responseBody = {
      success: true,
      original: text,
      preset,
      result,
      execution_time_ms: executionTime
    };
    await logRequest(req, { action: preset, actions: presetActions, text }, 200, executionTime, text.length, JSON.stringify(responseBody).length);

    return res.json(responseBody);
  }

  if (preset) {
    // Preset not found (neither built-in nor custom)
    const executionTime = Date.now() - startTime;
    await logRequest(req, { action: preset, actions: null, text }, 400, executionTime, text.length, 0);
    return res.status(400).json({ 
      success: false, 
      error: `Unknown preset: ${preset}`, 
      status: 400 
    });
  }

  // Handle chaining (actions is always an array here)
  if (actions && actions.length > 0) {
  const params = { limit, length, type };
  const result = await executeChainedTransform(req, text, actions, params);
    const executionTime = Date.now() - startTime;

    if (result.error) {
      await logRequest(req, { action: actions[0], actions, text }, 400, executionTime, text.length, 0);
      return res.status(400).json({ success: false, error: result.error, status: result.status });
    }

    const finalAction = actions[actions.length - 1];
    let finalResult;
    if (result.transformations && result.transformations[finalAction]) {
      finalResult = result.transformations[finalAction].result;
    }

    if (webhook) {
      sendWebhook(webhook, { original: text, actions, result: finalResult, execution_time_ms: executionTime });
    }

    const responseBody = {
      success: true,
      original: text,
      actions,
      result: finalResult,
      execution_time_ms: executionTime
    };
    await logRequest(req, { action: finalAction, actions, text }, 200, executionTime, text.length, JSON.stringify(responseBody).length);

    return res.json(responseBody);
  }

  // Single transformation
  const params = { limit, length, type };
  const result = await executeTransform(req, text, action, params);
  const executionTime = Date.now() - startTime;

  if (!result) {
    await logRequest(req, { action, actions: null, text }, 400, executionTime, text.length, 0);
    return res.status(400).json({
      success: false,
      error: `Invalid action: ${action}`,
      status: 400
    });
  }

  if (result.error) {
    await logRequest(req, { action, actions: null, text }, 500, executionTime, text.length, 0);
    return res.status(500).json({ success: false, error: result.error, status: result.status });
  }

  if (webhook) {
    sendWebhook(webhook, { original: text, action, result: result.result, execution_time_ms: executionTime });
  }

  const responseBody = {
    success: true,
    original: text,
    action,
    result: result.result,
    execution_time_ms: executionTime
  };
  await logRequest(req, { action, actions: null, text }, 200, executionTime, text.length, JSON.stringify(responseBody).length);

  return res.json(responseBody);
}

/**
 * Coerce a value that may be a string, array, or other type to a plain string.
 * Arrays (possible via HTTP parameter tampering) are rejected by returning undefined.
 * @param {*} val
 * @returns {string|undefined}
 */
function toStr(val) {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'string') return val;
  // Reject arrays and objects (parameter tampering / type confusion)
  return undefined;
}

/**
 * Coerce a value to a string, also accepting numbers (e.g. numeric JSON fields).
 * Arrays and objects are rejected.
 * @param {*} val
 * @returns {string|undefined}
 */
function toStrOrNum(val) {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  return undefined;
}

/**
 * GET /transform - Single transformation via query parameters
 *
 * Query parameters:
 * - text (required): The text to transform
 * - action (required): Single transformation type
 * - actions (optional): Comma-separated list for chaining
 * - preview (optional): 'true' to return all transformations
 * - preset (optional): 'url', 'human', or 'clean'
 * - limit (optional): For truncate action
 * - length (optional): For random action
 * - type (optional): For random action (alnum, alpha, numeric, hex)
 * - webhook (optional): URL to POST result to
 */
app.get('/transform', async (req, res) => {
  const text    = toStr(req.query.text);
  const action  = toStr(req.query.action);
  const preset  = toStr(req.query.preset);
  const limit   = toStr(req.query.limit);
  const length  = toStr(req.query.length);
  const type    = toStr(req.query.type);
  const webhook = toStr(req.query.webhook);
  const preview = toStr(req.query.preview) === 'true';
  // Normalize comma-separated actions string → array
  const rawActions = toStr(req.query.actions);
  const actions = rawActions ? rawActions.split(',').map(a => a.trim()).filter(Boolean) : undefined;
  return processTransformRequest(req,
    { text, action, actions, preview, preset, limit, length, type, webhook },
    res
  );
});

/**
 * POST /transform - Single transformation via JSON body
 *
 * Body:
 * {
 *   "text": "string",
 *   "action": "string",
 *   "actions": ["string"],
 *   "preview": false,
 *   "preset": "url",
 *   "limit": 10,
 *   "length": 10,
 *   "type": "alnum"
 * }
 */
app.post('/transform', async (req, res) => {
  const text    = toStr(req.body.text);
  const action  = toStr(req.body.action);
  const preset  = toStr(req.body.preset);
  const limit   = toStrOrNum(req.body.limit);
  const length  = toStrOrNum(req.body.length);
  const type    = toStr(req.body.type);
  const webhook = toStr(req.body.webhook);
  const preview = req.body.preview === true || req.body.preview === 'true';
  // Normalize actions: accept array of strings or comma-separated string
  let actions = req.body.actions;
  if (typeof actions === 'string') {
    actions = actions.split(',').map(a => a.trim()).filter(Boolean);
  } else if (Array.isArray(actions)) {
    actions = actions.map(a => (typeof a === 'string' ? a : String(a))).filter(Boolean);
  } else {
    actions = undefined;
  }
  return processTransformRequest(req,
    { text, action, actions, preview, preset, limit, length, type, webhook },
    res
  );
});


/**
 * POST /v1/run - Pipeline execution endpoint
 * 
 * This is the "killer feature" - execute a pipeline of transformations
 * in sequence, where each step's output becomes the next step's input.
 * 
 * Body:
 * {
 *   "input": "Hello World!",
 *   "pipeline": ["slugify", "reverse", "base64encode"]
 * }
 * 
 * Returns:
 * {
 *   "success": true,
 *   "input": "Hello World!",
 *   "pipeline": ["slugify", "reverse", "base64encode"],
 *   "result": "b2xsZWgtZGxyb3c=",
 *   "steps": [
 *     { "step": 1, "action": "slugify", "result": "hello-world", "execution_time_ms": 2 },
 *     { "step": 2, "action": "reverse", "result": "dlrow-olleh", "execution_time_ms": 1 },
 *     { "step": 3, "action": "base64encode", "result": "b2xsZWgtZGxyb3c=", "execution_time_ms": 1 }
 *   ],
 *   "execution_time_ms": 4
 * }
 */
app.post('/v1/run', async (req, res) => {
  const startTime = Date.now();
  const { input, pipeline, limit, length, type, webhook } = req.body;

  // Validate required parameters
  if (!input || typeof input !== 'string') {
    const executionTime = Date.now() - startTime;
    await logRequest(req, { action: 'pipeline', actions: pipeline, text: input?.substring(0, 100) }, 400, executionTime, 0, 0);
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid required field: input (must be a non-empty string)',
      status: 400
    });
  }

  if (!pipeline || !Array.isArray(pipeline) || pipeline.length === 0) {
    const executionTime = Date.now() - startTime;
    await logRequest(req, { action: 'pipeline', actions: pipeline, text: input?.substring(0, 100) }, 400, executionTime, 0, 0);
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid required field: pipeline (must be a non-empty array of actions)',
      status: 400
    });
  }

  // Validate text length
  const validation = validateText(input);
  if (!validation.valid) {
    const executionTime = Date.now() - startTime;
    await logRequest(req, { action: 'pipeline', actions: pipeline, text: input.substring(0, 100) }, 400, executionTime, input.length, 0);
    return res.status(400).json({
      success: false,
      error: validation.error,
      status: 400
    });
  }

  // Validate all actions exist
  const availableActions = getAvailableActions();
  for (const action of pipeline) {
    if (!availableActions.includes(action)) {
      const executionTime = Date.now() - startTime;
      await logRequest(req, { action: 'pipeline', actions: pipeline, text: input.substring(0, 100) }, 400, executionTime, input.length, 0);
      return res.status(400).json({
        success: false,
        error: `Invalid action in pipeline: ${action}`,
        status: 400
      });
    }
  }

  const params = { limit, length, type };
  const steps = [];
  let currentText = input;

  // Execute pipeline sequentially
  for (let i = 0; i < pipeline.length; i++) {
    const action = pipeline[i];
    const stepStartTime = Date.now();
    
    const result = await executeTransform(req, currentText, action, params);
    
    if (!result) {
      const executionTime = Date.now() - startTime;
      await logRequest(req, { action: 'pipeline', actions: pipeline, text: input.substring(0, 100) }, 400, executionTime, input.length, 0);
      return res.status(400).json({
        success: false,
        error: `Invalid action: ${action}`,
        status: 400
      });
    }

    if (result.error) {
      const executionTime = Date.now() - startTime;
      await logRequest(req, { action: 'pipeline', actions: pipeline, text: input.substring(0, 100) }, 500, executionTime, input.length, 0);
      return res.status(500).json({
        success: false,
        error: result.error,
        status: result.status
      });
    }

    const stepResult = result.result;
    steps.push({
      step: i + 1,
      action,
      result: stepResult,
      execution_time_ms: result.execution_time_ms
    });

    // Use the result as input for the next step
    if (typeof stepResult === 'string' || typeof stepResult === 'number') {
      currentText = String(stepResult);
    } else if (typeof stepResult === 'object') {
      // For actions that return objects (countwords, palindromecheck), stringify for next step
      currentText = JSON.stringify(stepResult);
    }
  }

  const executionTime = Date.now() - startTime;
  const finalResult = currentText;

  // Send webhook if provided
  if (webhook) {
    sendWebhook(webhook, {
      input,
      pipeline,
      result: finalResult,
      steps,
      execution_time_ms: executionTime
    });
  }

  const responseBody = {
    success: true,
    input,
    pipeline,
    result: finalResult,
    steps,
    execution_time_ms: executionTime
  };

  await logRequest(req, { action: 'pipeline', actions: pipeline, text: input.substring(0, 100) }, 200, executionTime, JSON.stringify(req.body).length, JSON.stringify(responseBody).length);

  res.json(responseBody);
});


/**
 * POST /batch - Batch processing endpoint
 * 
 * Body:
 * {
 *   "items": ["text1", "text2"],
 *   "action": "string"
 * }
 */
app.post('/batch', async (req, res) => {
  const { items, action, limit, length, type, webhook } = req.body;
  
  // Validate required parameters
  if (!items || !Array.isArray(items) || items.length === 0) {
    const executionTime = Date.now() - startTime;
    await logRequest(req, { action: 'batch', actions: [action], text: `batch:${items.length}` }, 400, executionTime, 0, 0);
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid field: items (must be a non-empty array)',
      status: 40000
    });
  }

  if (!action) {
    const executionTime = Date.now() - startTime;
    await logRequest(req, { action: 'batch', actions: null, text: `batch:${items.length}` }, 400, executionTime, 0, 0);
    return res.status(400).json({
      success: false,
      error: 'Missing required field: action',
      status: 400
    });
  }

  // Validate action exists
  if (!getTransformFunction(action)) {
    const executionTime = Date.now() - startTime;
    await logRequest(req, { action: 'batch', actions: [action], text: `batch:${items.length}` }, 400, executionTime, 0, 0);
    return res.status(400).json({
      success: false,
      error: `Invalid action: ${action}`,
      status: 400
    });
  }

  const params = { limit, length, type };
  const batchStartTime = Date.now();
  
  // Process items in parallel while maintaining order
  const results = await Promise.all(
    items.map(async (item, index) => {
      try {
        // Validate text length
        const validation = validateText(item);
        if (!validation.valid) {
          return {
            index,
            original: item,
            success: false,
            error: validation.error
          };
        }
        
        const result = await executeTransform(req, item, action, params);
        
        if (!result) {
          return {
            index,
            original: item,
            success: false,
            error: `Invalid action: ${action}`
          };
        }
        
        if (result.error) {
          return {
            index,
            original: item,
            success: false,
            error: result.error
          };
        }
        
        return {
          index,
          original: item,
          success: true,
          action,
          result: result.result,
          execution_time_ms: result.execution_time_ms
        };
      } catch (err) {
        logger.error('Batch processing error', { item: item.substring(0, 50), error: err.message });
        return {
          index,
          original: item,
          success: false,
          error: `Processing error: ${err.message}`
        };
      }
    })
  );
  
  const executionTime = Date.now() - batchStartTime;

  // Send webhook with batch result if provided
  if (webhook) {
    sendWebhook(webhook, {
      action,
      totalItems: items.length,
      results,
      execution_time_ms: executionTime
    });
  }

  const responseBody = {
    success: true,
    action,
    totalItems: items.length,
    results,
    execution_time_ms: executionTime
  };
  await logRequest(req, { action: 'batch', actions: [action], text: `batch:${items.length}` }, 200, executionTime, JSON.stringify(req.body).length, JSON.stringify(responseBody).length);

  res.json(responseBody);
});

// ============================================
// Swagger UI Documentation
// ============================================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// ============================================
// Error Handling
// ============================================

// Dashboard catch-all: serve dashboard index.html for client-side routes
const dashboardRoutes = ['/dashboard', '/keys', '/billing', '/docs', '/pricing', '/login', '/register', '/reset-password', '/verify-email'];
app.get(dashboardRoutes, (req, res) => {
  res.sendFile(path.join(dashboardBuildPath, 'server', 'app', 'dashboard.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    status: 404
  });
});

// Global error handler
app.use((err, req, res, next) => {
  stats.errors++;
  
  logger.error('Unhandled error', err);
  
  // Handle JSON parse errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      status: 400
    });
  }
  
  // Handle other errors
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    status: 500
  });
});

// ============================================
// Server Startup
// ============================================

async function startServer() {
  try {
    const cacheAvailable = await initRedis();
    if (cacheAvailable) {
      logger.info('Redis cache initialized successfully');
    } else {
      logger.info('Using in-memory cache fallback');
    }
  } catch (err) {
    logger.warn('Redis initialization error', { error: err.message });
  }

  // Initialize database and run migrations
  try {
    await db.init();
    await runMigrations();
    logger.info('Database initialized and migrations applied');
  } catch (err) {
    logger.error('Database initialization failed', { error: err.message });
    throw err;
  }

  await initRateLimiter();

  // Start automatic cleanup for rate limiter
  startCleanup();

  // Start Express server and store reference for graceful shutdown
  server = app.listen(PORT, () => {
    logger.info(`TextForge API listening on port ${PORT}`, { env: NODE_ENV });
  });
  return server;
}

// Only auto-start the server when this file is the entry point (not when required by tests)
if (require.main === module) {
  startServer().catch((err) => {
    logger.error('Failed to start server', err);
    process.exit(1);
  });
}

// ============================================
// Graceful Shutdown Handling
// ============================================

let server = null;
let isShuttingDown = false;

/**
 * Gracefully shutdown the application
 * @param {string} signal - The signal that triggered shutdown
 */
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress');
    return;
  }
  isShuttingDown = true;
  
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  const startTime = Date.now();
  
  try {
    // Close server first to stop accepting new connections
    if (server) {
      await new Promise((resolve, reject) => {
        server.close(resolve);
        setTimeout(() => reject(new Error('Server close timeout')), 10000); // 10s timeout
      });
      logger.info('HTTP server closed');
    }
    
    // Close database connection
    try {
      db.close();
      logger.info('Database connection closed');
    } catch (dbErr) {
      logger.warn('Database close error', { error: dbErr.message });
    }
    
    // Stop rate limiter cleanup interval
    clearInterval(startCleanup());
    logger.info('Rate limiter cleanup stopped');
    
    // Close Redis connection if available
    try {
      const redis = await import('redis');
      if (redisClient) {
        await redisClient.quit();
        logger.info('Redis connection closed');
      }
    } catch (redisErr) {
      logger.warn('Redis close error', { error: redisErr.message });
    }
    
    const duration = Date.now() - startTime;
    logger.info(`Graceful shutdown completed in ${duration}ms`);
  } catch (err) {
    logger.error('Error during graceful shutdown', err);
    process.exit(1);
  }
  
  // Exit with success code
  process.exit(0);
}

// Register signal handlers for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export for testing and standalone execution
module.exports = { app, startServer, gracefulShutdown };
