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

const { rateLimiterMiddleware, getStats: getRateStats, startCleanup } = require('./rateLimiter');
const { initRedis, get: cacheGet, set: cacheSet, clear: cacheClear, generateCacheKey, getStats: getCacheStats } = require('./cache');

// Routes
const authRouter = require('./routes/auth');
const keysRouter = require('./routes/keys');
const billingRouter = require('./routes/billing');
const usersRouter = require('./routes/users');
const stripeRouter = require('./routes/stripe');

// Initialize Express app
const app = express();

// Configuration
const PORT = parseInt(process.env.PORT, 10) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

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

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const method = req.method;
    const url = req.originalUrl;
    const status = res.statusCode;
    
    // Log in development mode
    if (NODE_ENV === 'development') {
      logger.debug(`${method} ${url} - ${status} (${duration}ms)`);
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
 * @param {string} text - Input text
 * @param {string} action - Transformation action
 * @param {object} params - Additional parameters
 * @returns {Promise<object>} Result object
 */
async function executeTransform(text, action, params = {}) {
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
    logger.error('Transformation execution failed', { action, error: err.message });
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
 * @param {string} text - Input text
 * @param {string[]} actions - Array of transformation actions
 * @param {object} params - Additional parameters
 * @returns {Promise<object>} Result with all transformations
 */
async function executeChainedTransform(text, actions, params = {}) {
  let currentText = text;
  const results = {};
  
  for (const action of actions) {
    const result = await executeTransform(currentText, action, params);
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
 * @param {string} text - Input text
 * @param {object} params - Additional parameters
 * @returns {Promise<object>} All transformation results
 */
async function executeAllTransforms(text, params = {}) {
  const actions = getAvailableActions();
  const results = {};
  
  for (const action of actions) {
    const result = await executeTransform(text, action, params);
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

// ============================================
// Routes
// ============================================

/**
 * GET /health - Health check endpoint
 * Returns API status and uptime
 */
app.get('/health', (req, res) => {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  const cacheStats = getCacheStats();
  
  res.json({
    success: true,
    status: 'healthy',
    uptime_seconds: uptime,
    cache: cacheStats,
    version: '1.0.0'
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
  const { text, action, actions, preview, preset, limit, length, type, webhook } = req.query;
  
  // Validate required parameters
  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: text',
      status: 400
    });
  }
  
  if (!action && !actions && !preview && !preset) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: action, actions, preview, or preset',
      status: 400
    });
  }
  
  // Validate text length
  const validation = validateText(text);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error,
      status: 400
    });
  }
  
  const startTime = Date.now();
  
  // Handle preview mode - return all transformations
  if (preview === 'true') {
    const params = { limit, length, type };
    const transformations = await executeAllTransforms(text, params);
    const executionTime = Date.now() - startTime;
    
    // Send webhook if provided
    if (webhook) {
      sendWebhook(webhook, {
        original: text,
        transformations,
        execution_time_ms: executionTime
      });
    }
    
    return res.json({
      success: true,
      original: text,
      transformations,
      execution_time_ms: executionTime
    });
  }
  
  // Handle presets
  if (preset && PRESETS[preset]) {
    const presetActions = PRESETS[preset];
    const params = { limit, length, type };
    const result = await executeChainedTransform(text, presetActions, params);
    const executionTime = Date.now() - startTime;
    
    if (result.error) {
      return res.status(400).json({
        success: false,
        error: result.error,
        status: result.status
      });
    }
    
    // Send webhook if provided
    if (webhook) {
      sendWebhook(webhook, {
        original: text,
        preset,
        result,
        execution_time_ms: executionTime
      });
    }
    
    return res.json({
      success: true,
      original: text,
      preset,
      result,
      execution_time_ms: executionTime
    });
  }
  
  // Handle chaining
  if (actions) {
    const actionList = actions.split(',').map(a => a.trim());
    const params = { limit, length, type };
    const result = await executeChainedTransform(text, actionList, params);
    const executionTime = Date.now() - startTime;
    
    if (result.error) {
      return res.status(400).json({
        success: false,
        error: result.error,
        status: result.status
      });
    }
    
    // Get the final result (last transformation output)
    const finalAction = actionList[actionList.length - 1];
    let finalResult;
    if (result.transformations && result.transformations[finalAction]) {
      finalResult = result.transformations[finalAction].result;
    }
    
    // Send webhook if provided
    if (webhook) {
      sendWebhook(webhook, {
        original: text,
        actions: actionList,
        result: finalResult,
        execution_time_ms: executionTime
      });
    }
    
    return res.json({
      success: true,
      original: text,
      actions: actionList,
      result: finalResult,
      execution_time_ms: executionTime
    });
  }
  
  // Single transformation
  const params = { limit, length, type };
  const result = await executeTransform(text, action, params);
  const executionTime = Date.now() - startTime;
  
  if (!result) {
    return res.status(400).json({
      success: false,
      error: `Invalid action: ${action}`,
      status: 400
    });
  }
  
  if (result.error) {
    return res.status(500).json({
      success: false,
      error: result.error,
      status: result.status
    });
  }
  
  // Send webhook if provided
  if (webhook) {
    sendWebhook(webhook, {
      original: text,
      action,
      result: result.result,
      execution_time_ms: executionTime
    });
  }
  
  res.json({
    success: true,
    original: text,
    action,
    result: result.result,
    execution_time_ms: executionTime
  });
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
  const { text, action, actions, preview, preset, limit, length, type, webhook } = req.body;
  
  // Validate required parameters
  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: text',
      status: 400
    });
  }
  
  if (!action && !actions && !preview && !preset) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: action, actions, preview, or preset',
      status: 400
    });
  }
  
  // Validate text length
  const validation = validateText(text);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error,
      status: 400
    });
  }
  
  const startTime = Date.now();
  
  // Handle preview mode - return all transformations
  if (preview === true) {
    const params = { limit, length, type };
    const transformations = await executeAllTransforms(text, params);
    const executionTime = Date.now() - startTime;
    
    if (webhook) {
      sendWebhook(webhook, {
        original: text,
        transformations,
        execution_time_ms: executionTime
      });
    }
    
    return res.json({
      success: true,
      original: text,
      transformations,
      execution_time_ms: executionTime
    });
  }
  
  // Handle presets
  if (preset && PRESETS[preset]) {
    const presetActions = PRESETS[preset];
    const params = { limit, length, type };
    const result = await executeChainedTransform(text, presetActions, params);
    const executionTime = Date.now() - startTime;
    
    if (result.error) {
      return res.status(400).json({
        success: false,
        error: result.error,
        status: result.status
      });
    }
    
    if (webhook) {
      sendWebhook(webhook, {
        original: text,
        preset,
        result,
        execution_time_ms: executionTime
      });
    }
    
    return res.json({
      success: true,
      original: text,
      preset,
      result,
      execution_time_ms: executionTime
    });
  }
  
  // Handle chaining
  if (actions && Array.isArray(actions)) {
    const params = { limit, length, type };
    const result = await executeChainedTransform(text, actions, params);
    const executionTime = Date.now() - startTime;
    
    if (result.error) {
      return res.status(400).json({
        success: false,
        error: result.error,
        status: result.status
      });
    }
    
    const finalAction = actions[actions.length - 1];
    let finalResult;
    if (result.transformations && result.transformations[finalAction]) {
      finalResult = result.transformations[finalAction].result;
    }
    
    if (webhook) {
      sendWebhook(webhook, {
        original: text,
        actions,
        result: finalResult,
        execution_time_ms: executionTime
      });
    }
    
    return res.json({
      success: true,
      original: text,
      actions,
      result: finalResult,
      execution_time_ms: executionTime
    });
  }
  
  // Single transformation
  const params = { limit, length, type };
  const result = await executeTransform(text, action, params);
  const executionTime = Date.now() - startTime;
  
  if (!result) {
    return res.status(400).json({
      success: false,
      error: `Invalid action: ${action}`,
      status: 400
    });
  }
  
  if (result.error) {
    return res.status(500).json({
      success: false,
      error: result.error,
      status: result.status
    });
  }
  
  if (webhook) {
    sendWebhook(webhook, {
      original: text,
      action,
      result: result.result,
      execution_time_ms: executionTime
    });
  }
  
  res.json({
    success: true,
    original: text,
    action,
    result: result.result,
    execution_time_ms: executionTime
  });
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
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid field: items (must be a non-empty array)',
      status: 400
    });
  }
  
  if (!action) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: action',
      status: 400
    });
  }
  
  // Validate action exists
  if (!getTransformFunction(action)) {
    return res.status(400).json({
      success: false,
      error: `Invalid action: ${action}`,
      status: 400
    });
  }
  
  const params = { limit, length, type };
  const startTime = Date.now();
  
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
        
        const result = await executeTransform(item, action, params);
        
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
  
  const executionTime = Date.now() - startTime;
  
  // Send webhook with batch result if provided
  if (webhook) {
    sendWebhook(webhook, {
      action,
      totalItems: items.length,
      results,
      execution_time_ms: executionTime
    });
  }
  
  res.json({
    success: true,
    action,
    totalItems: items.length,
    results,
    execution_time_ms: executionTime
  });
});

// ============================================
// Error Handling
// ============================================

// ============================================
// API Routes
// ============================================

// Stripe webhook must be before JSON body parser (uses raw body)
app.use('/api', stripeRouter);

// Auth, keys, billing, user routes
app.use('/auth', authRouter);
app.use('/api/keys', keysRouter);
app.use('/billing', billingRouter);
app.use('/users', usersRouter);

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
  // Initialize Redis cache (non-blocking)
  initRedis().then((available) => {
    if (available) {
      logger.info('Redis cache initialized successfully');
    } else {
      logger.info('Using in-memory cache fallback');
    }
  }).catch((err) => {
    logger.warn('Redis initialization error', { error: err.message });
  });
  
  // Start automatic cleanup for rate limiter
  startCleanup();
  
  // Start Express server
  app.listen(PORT, () => {
    logger.info(`TextForge API listening on port ${PORT}`, { env: NODE_ENV });
  });
}

// Start the server
startServer().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});

// Export for testing
module.exports = { app };
