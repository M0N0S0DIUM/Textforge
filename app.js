/**
 * TextForge - Smart Text Utility API
 * 
 * A lightweight REST API providing 23 text transformation utilities
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
    console.error('Request logging failed:', err.message, err.stack);
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
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 { color: #1a73e8; }
    .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 40px 0; }
    .feature { padding: 20px; border-radius: 8px; background: #f5f5f5; }
    a { color: #1a73e8; text-decoration: none; font-weight: bold; }
    a:hover { text-decoration: underline; }
    .code-example {
      background: #2d2d2d;
      color: #f8f8f2;
      padding: 20px;
      border-radius: 8px;
      font-family: monospace;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <h1>TextForge - Smart Text Utility API</h1>
  <p>A lightweight REST API providing <strong>23 text transformation utilities</strong> through a single, simple endpoint.</p>
  
  <div class="features">
    <div class="feature">
      <h3>🚀 Fast Performance</h3>
      <p>Average response times of 4-7ms per transformation</p>
    </div>
    <div class="feature">
      <h3>🔗 Chained Operations</h3>
      <p>Combine multiple transformations in one request</p>
    </div>
    <div class="feature">
      <h3>🔒 Smart Rate Limiting</h3>
      <p>Free: 1,000 req/day | Pro: 50,000 req/day with API key</p>
    </div>
  </div>

  <h2>Available Endpoints</h2>
  <ul>
    <li><a href="/health">GET /health</a> - Health check</li>
    <li><a href="/transform?text=Hello%20World&action=slugify">GET /transform</a> - Single transformation</li>
    <li><a href="/batch">POST /batch</a> - Batch processing (multiple texts at once)</li>
    <li><a href="/stats">GET /stats</a> - API statistics & usage analytics</li>
  </ul>

  <h2>Quick Example</h2>
  <div class="code-example">curl "https://textforge.co/transform?text=Hello%20World!&action=slugify"</div>

  <p><a href="/docs">View API Documentation</a></p>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
});

/**
 * GET /health - Health check endpoint
 * Returns API status, database status, Redis connectivity, and uptime
 */
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
} else {
  // Dashboard not built yet - redirect to API docs
  app.get('/dashboard', (req, res) => res.redirect('/api-docs'));
  app.get('/billing', (req, res) => res.redirect('/api-docs'));
  app.get('/keys', (req, res) => res.redirect('/api-docs'));
  app.get('/docs', (req, res) => res.redirect('/api-docs'));
}

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
  if (!text) {
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
