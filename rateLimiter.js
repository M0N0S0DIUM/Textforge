/**
 * TextForge - Rate Limiter Module
 * 
 * Implements rate limiting with support for:
 * - Free tier: 1000 requests/day per API key
 * - Pro tier: 50,000 requests/day per API key
 * - In-memory storage with automatic cleanup
 * - X-API-Key header authentication with HMAC verification
 * 
 * Falls back to per-IP rate limiting when no API key is provided.
 */

const db = require('./db');
const logger = require('./logger');
const crypto = require('crypto');
const { API_KEY_PREFIX, hashApiKey, isApiKeyFormatValid } = require('./apiKeys');

// Rate limit constants
const FREE_TIER_LIMIT = 1000;
const PRO_TIER_LIMIT = 50000;
const DAY_IN_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Clean up every hour

const rateLimitStore = new Map();
let redisClient = null;
let redisAvailable = false;
let warnedInMemoryFallback = false;

/**
 * Get or create a rate limit entry for a given key
 * @param {string} key - Unique identifier (API key or IP)
 * @returns {object} Rate limit entry with count and reset time
 */
function getMemoryRateLimitEntry(key) {
  const now = Date.now();
  let entry = rateLimitStore.get(key);
  
  // Create new entry if it doesn't exist or has expired
  if (!entry || now >= entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + DAY_IN_MS
    };
    rateLimitStore.set(key, entry);
  }
  
  return entry;
}

function logInMemoryFallback(reason) {
  if (warnedInMemoryFallback) {
    return;
  }
  warnedInMemoryFallback = true;
  logger.warn(`Rate limiter: falling back to in-memory mode (reason: ${reason}). Limits are not shared across instances.`);
}

/**
 * Initialize Redis-backed rate limiting if REDIS_URL is configured
 * @returns {Promise<boolean>} Whether Redis-backed rate limiting is available
 */
async function initRateLimiter() {
  const url = process.env.REDIS_URL;

  if (!url) {
    redisAvailable = false;
    redisClient = null;
    logger.info('Rate limiter: REDIS_URL is not configured; using in-memory mode');
    logInMemoryFallback('REDIS_URL not configured');
    return false;
  }

  try {
    const redis = await import('redis');
    redisClient = redis.createClient({ url });

    redisClient.on('error', (err) => {
      const wasAvailable = redisAvailable;
      redisAvailable = false;
      redisClient = null;
      if (wasAvailable) {
        logger.warn('Rate limiter: Redis connection lost; falling back to in-memory mode', { error: err.message });
      }
      logInMemoryFallback('Redis became unavailable');
    });

    await redisClient.connect();
    redisAvailable = true;
    warnedInMemoryFallback = false;
    logger.info('Rate limiter: Redis initialized successfully');
    return true;
  } catch (err) {
    redisAvailable = false;
    redisClient = null;
    logger.warn('Rate limiter: Redis configured but unavailable; falling back to in-memory mode', {
      error: err.message
    });
    logInMemoryFallback('Redis configured but connection failed');
    return false;
  }
}

function getRedisRateLimitKey(identifier) {
  const identifierHash = crypto.createHash('sha256').update(identifier).digest('hex');
  return `tf:rate_limit:${identifierHash}`;
}

function incrementMemoryRateLimit(key) {
  const entry = getMemoryRateLimitEntry(key);
  entry.count++;
  return entry;
}

async function incrementRedisRateLimit(identifier) {
  const key = getRedisRateLimitKey(identifier);
  const count = await redisClient.incr(key);
  let ttlMs = await redisClient.pTTL(key);

  if (ttlMs < 0) {
    await redisClient.pExpire(key, DAY_IN_MS);
    ttlMs = DAY_IN_MS;
  }

  return {
    count,
    resetAt: Date.now() + ttlMs
  };
}

async function incrementRateLimit(identifier) {
  if (redisAvailable && redisClient) {
    try {
      return await incrementRedisRateLimit(identifier);
    } catch (err) {
      redisAvailable = false;
      redisClient = null;
      logger.warn('Rate limiter: Redis request failed; switching to in-memory mode for this instance', { error: err.message });
      logInMemoryFallback('Redis request failed mid-flight');
    }
  }

  return incrementMemoryRateLimit(identifier);
}

function safeEqualHex(left, right) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Check if an API key is valid and get its tier
 * @param {string} apiKey - API key to validate
 * @returns {Promise<{ valid: boolean, tier: string, keyHash?: string }>}
 */
async function validateApiKey(apiKey) {
  if (!isApiKeyFormatValid(apiKey)) {
    return { valid: false, tier: 'free' };
  }
  
  try {
    const apiKeyHash = hashApiKey(apiKey);
    let keyRecord = db.prepare('SELECT * FROM api_keys WHERE key_hash = ?').get(apiKeyHash);

    if (!keyRecord) {
      keyRecord = db.prepare('SELECT * FROM api_keys WHERE key = ?').get(apiKey);
      if (keyRecord) {
        db.prepare('UPDATE api_keys SET key_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
          apiKeyHash,
          keyRecord.id
        );
        keyRecord.key_hash = apiKeyHash;
      }
    }
    
    if (!keyRecord) {
      logger.warn('Invalid API key attempted', { keyPrefix: apiKey.substring(0, 10) });
      return { valid: false, tier: 'free' };
    }

    if (keyRecord.key_hash && !safeEqualHex(apiKeyHash, keyRecord.key_hash)) {
      logger.warn('API key hash mismatch detected', { keyId: keyRecord.id });
      return { valid: false, tier: 'free' };
    }

    return { valid: true, tier: keyRecord.tier || 'free', keyHash: apiKeyHash };
  } catch (err) {
    logger.error('Error validating API key', err);
    return { valid: false, tier: 'free' };
  }
}

/**
 * Check if a request is within rate limits
 * @param {string} apiKey - API key (or null for anonymous)
 * @param {string} ip - Client IP address (fallback identifier)
 * @returns {Promise<object>} Rate limit status with headers
 */
async function checkRateLimit(apiKey, ip) {
  let identifier = ip || 'anonymous';
  let tier = 'free';

  if (apiKey) {
    const validation = await validateApiKey(apiKey);
    if (validation.valid) {
      tier = validation.tier;
      identifier = `api:${validation.keyHash}`;
    }
  }
  
  const limit = tier === 'pro' ? PRO_TIER_LIMIT : FREE_TIER_LIMIT;
  const entry = await incrementRateLimit(identifier);
  
  const retryAfter = Math.ceil((entry.resetAt - Date.now()) / 1000);
  
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    limit,
    retryAfter: entry.count > limit ? retryAfter : 0,
    resetAt: entry.resetAt,
    tier
  };
}

/**
 * Rate limiting middleware factory
 * Returns an Express middleware function
 * @returns {Function} Express middleware
 */
function rateLimiterMiddleware() {
  return async (req, res, next) => {
    // Get API key from header
    const apiKey = req.headers['x-api-key'] || null;
    
    // Get client IP
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Check rate limit
    const status = await checkRateLimit(apiKey, ip);
    
    // Set rate limit headers on all responses
    res.set('X-RateLimit-Limit', String(status.limit));
    res.set('X-RateLimit-Remaining', String(status.remaining));
    res.set('X-RateLimit-Reset', String(Math.floor(status.resetAt / 1000)));
    
    if (!status.allowed) {
      // Rate limit exceeded
      logger.warn('Rate limit exceeded', { tier: status.tier, ip });
      res.set('Retry-After', String(status.retryAfter));
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        status: 429,
        retryAfter: status.retryAfter,
        message: `Too many requests. Limit: ${status.limit}/day. Try again in ${status.retryAfter} seconds.`
      });
    }
    
    // Store rate limit info on request for stats tracking
    req.rateLimit = status;
    next();
  };
}

/**
 * Clean up expired entries from the rate limit store
 */
function cleanupRateLimitStore() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug('Cleaned up rate limit entries', { count: cleaned });
  }
}

/**
 * Start automatic cleanup interval
 */
function startCleanup() {
  const interval = setInterval(cleanupRateLimitStore, CLEANUP_INTERVAL);
  if (typeof interval.unref === 'function') {
    interval.unref();
  }
}

/**
 * Get current rate limit stats
 * @returns {object} Rate limiting statistics
 */
function getStats() {
  const now = Date.now();
  const activeEntries = [];
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now < entry.resetAt) {
      activeEntries.push({
        key,
        count: entry.count,
        resetAt: entry.resetAt
      });
    }
  }
  
  return {
    backend: redisAvailable ? 'redis' : 'memory',
    redisAvailable,
    totalEntries: activeEntries.length,
    entries: activeEntries
  };
}

/**
 * Reset rate limit for a specific key (useful for testing)
 * @param {string} key - Key to reset
 */
async function resetRateLimit(key) {
  const normalizedKey = isApiKeyFormatValid(key) ? `api:${hashApiKey(key)}` : key;
  rateLimitStore.delete(key);
  rateLimitStore.delete(normalizedKey);
  if (redisAvailable && redisClient) {
    try {
      await redisClient.del(getRedisRateLimitKey(key));
      if (normalizedKey !== key) {
        await redisClient.del(getRedisRateLimitKey(normalizedKey));
      }
    } catch (err) {
      logger.warn('Failed to reset Redis rate limit entry', { error: err.message });
    }
  }
}

module.exports = {
  API_KEY_PREFIX,
  initRateLimiter,
  rateLimiterMiddleware,
  checkRateLimit,
  validateApiKey,
  hashApiKey,
  getStats,
  resetRateLimit,
  startCleanup,
  FREE_TIER_LIMIT,
  PRO_TIER_LIMIT
};
