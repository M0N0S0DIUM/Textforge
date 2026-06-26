/**
 * TextForge - Rate Limiter Module
 *
 * Implements rate limiting with support for:
 * - Free tier: 1000 requests/day, 60 requests/minute, burst of 10
 * - Pro tier: 50,000 requests/day, 1000 requests/minute, burst of 50
 * - In-memory storage with automatic cleanup and disk persistence
 * - X-API-Key header authentication with HMAC verification
 * - Redis-backed shared rate limiting across instances
 *
 * Falls back to per-IP rate limiting when no API key is provided.
 */

const db = require('./db');
const logger = require('./logger');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { API_KEY_PREFIX, hashApiKey, isApiKeyFormatValid } = require('./apiKeys');

// Rate limit constants
const FREE_TIER_LIMIT = 1000;           // requests per day
const PRO_TIER_LIMIT = 50000;           // requests per day
const FREE_TIER_PER_MINUTE = 60;        // requests per minute
const PRO_TIER_PER_MINUTE = 1000;       // requests per minute
const FREE_TIER_BURST = 10;             // burst capacity (token bucket)
const PRO_TIER_BURST = 50;              // burst capacity (token bucket)
const DAY_IN_MS = 24 * 60 * 60 * 1000;  // 24 hours in milliseconds
const MINUTE_IN_MS = 60 * 1000;         // 1 minute in milliseconds
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Clean up every hour
const PERSISTENCE_INTERVAL = 30 * 1000;  // Persist to disk every 30 seconds
const PERSISTENCE_FILE = path.join(__dirname, '..', 'data', 'rate-limit-store.json');

// In-memory rate limit store
// Structure: Map<identifier, { daily: {count, resetAt}, minute: {timestamps[]}, burst: {tokens, lastRefill} }>
const rateLimitStore = new Map();
let redisClient = null;
let _redisAvailable = false;
let warnedInMemoryFallback = false;
let persistenceTimer = null;

/**
 * Load persisted rate limit store from disk
 */
function loadPersistedStore() {
  try {
    if (fs.existsSync(PERSISTENCE_FILE)) {
      const data = JSON.parse(fs.readFileSync(PERSISTENCE_FILE, 'utf8'));
      const now = Date.now();
      let loaded = 0;

      for (const [key, entry] of Object.entries(data)) {
        // Only load non-expired daily entries
        if (entry.daily && now < entry.daily.resetAt) {
          // Filter minute timestamps to last minute
          const recentMinuteTimestamps = (entry.minute?.timestamps || []).filter(ts => now - ts < MINUTE_IN_MS);
          // Calculate burst tokens based on time elapsed
          let tokens = entry.burst?.tokens ?? (entry.daily.count > 1000 ? PRO_TIER_BURST : FREE_TIER_BURST);
          let lastRefill = entry.burst?.lastRefill ?? now;
          const burstLimit = entry.daily.count > 1000 ? PRO_TIER_BURST : FREE_TIER_BURST;
          const perMinuteLimit = entry.daily.count > 1000 ? PRO_TIER_PER_MINUTE : FREE_TIER_PER_MINUTE;
          const refillRate = perMinuteLimit / 60000; // tokens per ms
          const elapsed = now - lastRefill;
          tokens = Math.min(burstLimit, tokens + elapsed * refillRate);

          rateLimitStore.set(key, {
            daily: entry.daily,
            minute: { timestamps: recentMinuteTimestamps },
            burst: { tokens, lastRefill: now }
          });
          loaded++;
        }
      }
      logger.info('Rate limiter: Loaded persisted store', { entries: loaded });
    }
  } catch (err) {
    logger.warn('Rate limiter: Failed to load persisted store', { error: err.message });
  }
}

/**
 * Save rate limit store to disk (only daily counters and burst state)
 */
function savePersistedStore() {
  try {
    const data = {};
    const now = Date.now();

    for (const [key, entry] of rateLimitStore.entries()) {
      // Only persist non-expired daily entries
      if (entry.daily && now < entry.daily.resetAt) {
        data[key] = {
          daily: entry.daily,
          minute: { timestamps: entry.minute?.timestamps || [] },
          burst: entry.burst
        };
      }
    }

    // Ensure directory exists
    const dir = path.dirname(PERSISTENCE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(data));
    logger.debug('Rate limiter: Persisted store to disk', { entries: Object.keys(data).length });
  } catch (err) {
    logger.warn('Rate limiter: Failed to persist store', { error: err.message });
  }
}

/**
 * Start automatic persistence interval
 */
function startPersistence() {
  if (persistenceTimer) {
    clearInterval(persistenceTimer);
  }
  persistenceTimer = setInterval(savePersistedStore, PERSISTENCE_INTERVAL);
  if (typeof persistenceTimer.unref === 'function') {
    persistenceTimer.unref();
  }
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
  // Load persisted store first
  loadPersistedStore();
  startPersistence();

  const url = process.env.REDIS_URL;

  if (!url) {
    _redisAvailable = false;
    redisClient = null;
    logger.info('Rate limiter: REDIS_URL is not configured; using in-memory mode with disk persistence');
    logInMemoryFallback('REDIS_URL not configured');
    return false;
  }

  try {
    const redis = await import('redis');
    redisClient = redis.createClient({ url });

    redisClient.on('error', (err) => {
      const wasAvailable = _redisAvailable;
      _redisAvailable = false;
      redisClient = null;
      if (wasAvailable) {
        logger.warn('Rate limiter: Redis connection lost; falling back to in-memory mode', { error: err.message });
      }
      logInMemoryFallback('Redis became unavailable');
    });

    await redisClient.connect();
    _redisAvailable = true;
    warnedInMemoryFallback = false;
    logger.info('Rate limiter: Redis initialized successfully');
    return true;
  } catch (err) {
    _redisAvailable = false;
    redisClient = null;
    logger.warn('Rate limiter: Redis configured but unavailable; falling back to in-memory mode', {
      error: err.message
    });
    logInMemoryFallback('Redis configured but connection failed');
    return false;
  }
}

/**
 * Get Redis key for a given identifier and limit type
 * Uses full SHA-256 hash for consistency
 */
function getRedisRateLimitKey(identifier, type = 'daily') {
  const identifierHash = crypto.createHash('sha256').update(identifier).digest('hex');
  return `tf:rate_limit:${type}:${identifierHash}`;
}

/**
 * Hardened client IP extraction with proxy support
 * Respects X-Forwarded-For, X-Real-IP, and Express trust proxy setting
 */
function getClientIP(req) {
  // Check X-Forwarded-For header (may contain multiple IPs, take first)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }

  // Check X-Real-IP header (common with nginx)
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP.trim();
  }

  // Fall back to Express req.ip (respects trust proxy) or connection remoteAddress
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

/**
 * Get or create a rate limit entry for a given key (in-memory)
 */
function getMemoryRateLimitEntry(identifier) {
  const now = Date.now();
  let entry = rateLimitStore.get(identifier);

  // Determine tier from existing entry or default to free
  const isPro = entry?.daily?.count > 1000 || entry?.daily?.resetAt > now + DAY_IN_MS * 0.5; // heuristic
  const dailyLimit = isPro ? PRO_TIER_LIMIT : FREE_TIER_LIMIT;
  const perMinuteLimit = isPro ? PRO_TIER_PER_MINUTE : FREE_TIER_PER_MINUTE;
  const burstLimit = isPro ? PRO_TIER_BURST : FREE_TIER_BURST;

  // Create new entry if it doesn't exist or daily has expired
  if (!entry || now >= entry.daily?.resetAt) {
    entry = {
      daily: {
        count: 0,
        resetAt: now + DAY_IN_MS
      },
      minute: {
        timestamps: []
      },
      burst: {
        tokens: burstLimit,
        lastRefill: now
      }
    };
    rateLimitStore.set(identifier, entry);
  }

  // Ensure minute and burst structures exist (for backwards compatibility)
  if (!entry.minute) {
    entry.minute = { timestamps: [] };
  }
  if (!entry.burst) {
    entry.burst = { tokens: burstLimit, lastRefill: now };
  }

  return entry;
}

/**
 * Refill token bucket based on elapsed time
 */
function refillBurstTokens(burst, perMinuteLimit, burstLimit, now) {
  const refillRate = perMinuteLimit / 60000; // tokens per millisecond
  const elapsed = now - burst.lastRefill;
  burst.tokens = Math.min(burstLimit, burst.tokens + elapsed * refillRate);
  burst.lastRefill = now;
  return burst;
}

/**
 * Check and consume burst token
 * Returns { allowed: boolean, tokensRemaining: number }
 */
function checkBurstLimit(entry, tier, now) {
  const isPro = tier === 'pro';
  const perMinuteLimit = isPro ? PRO_TIER_PER_MINUTE : FREE_TIER_PER_MINUTE;
  const burstLimit = isPro ? PRO_TIER_BURST : FREE_TIER_BURST;

  refillBurstTokens(entry.burst, perMinuteLimit, burstLimit, now);

  if (entry.burst.tokens >= 1) {
    entry.burst.tokens -= 1;
    return { allowed: true, tokensRemaining: Math.floor(entry.burst.tokens) };
  }
  return { allowed: false, tokensRemaining: 0 };
}

/**
 * Check per-minute sliding window limit
 * Returns { allowed: boolean, count: number, remaining: number, resetAt: number }
 */
function checkMinuteLimit(entry, tier, now) {
  const isPro = tier === 'pro';
  const perMinuteLimit = isPro ? PRO_TIER_PER_MINUTE : FREE_TIER_PER_MINUTE;

  // Filter timestamps to last minute
  const recentTimestamps = entry.minute.timestamps.filter(ts => now - ts < MINUTE_IN_MS);
  entry.minute.timestamps = recentTimestamps;

  const count = recentTimestamps.length;
  const allowed = count < perMinuteLimit;

  if (allowed) {
    entry.minute.timestamps.push(now);
  }

  const windowStart = recentTimestamps.length > 0 ? recentTimestamps[0] : now;
  const resetAt = windowStart + MINUTE_IN_MS;

  return {
    allowed,
    count: count + (allowed ? 1 : 0),
    remaining: Math.max(0, perMinuteLimit - count - (allowed ? 1 : 0)),
    resetAt
  };
}

/**
 * Increment in-memory rate limit (daily + minute + burst)
 */
function incrementMemoryRateLimit(identifier, tier) {
  const now = Date.now();
  const entry = getMemoryRateLimitEntry(identifier);

  // Increment daily
  entry.daily.count++;

  // Check per-minute
  const minuteResult = checkMinuteLimit(entry, tier, now);

  // Check burst
  const burstResult = checkBurstLimit(entry, tier, now);

  // Determine overall allowed status
  const dailyLimit = tier === 'pro' ? PRO_TIER_LIMIT : FREE_TIER_LIMIT;
  const dailyAllowed = entry.daily.count <= dailyLimit;
  const allowed = dailyAllowed && minuteResult.allowed && burstResult.allowed;

  // Calculate retry-after based on most restrictive limit
  let retryAfter = 0;
  if (!allowed) {
    const retryTimes = [];
    if (!dailyAllowed) retryAfter = Math.ceil((entry.daily.resetAt - now) / 1000);
    if (!minuteResult.allowed) retryAfter = Math.max(retryAfter, Math.ceil((minuteResult.resetAt - now) / 1000));
    if (!burstResult.allowed) retryAfter = Math.max(retryAfter, 1); // burst refills quickly
  }

  return {
    count: entry.daily.count,
    resetAt: entry.daily.resetAt,
    allowed,
    remaining: Math.max(0, dailyLimit - entry.daily.count),
    minuteCount: minuteResult.count,
    minuteRemaining: minuteResult.remaining,
    minuteResetAt: minuteResult.resetAt,
    burstRemaining: burstResult.tokensRemaining,
    retryAfter
  };
}

/**
 * Increment Redis-backed rate limit (daily + minute + burst)
 */
async function incrementRedisRateLimit(identifier, tier) {
  const isPro = tier === 'pro';
  const dailyLimit = isPro ? PRO_TIER_LIMIT : FREE_TIER_LIMIT;
  const perMinuteLimit = isPro ? PRO_TIER_PER_MINUTE : FREE_TIER_PER_MINUTE;
  const burstLimit = isPro ? PRO_TIER_BURST : FREE_TIER_BURST;
  const now = Date.now();

  // Daily key
  const dailyKey = getRedisRateLimitKey(identifier, 'daily');
  const dailyCount = await redisClient.incr(dailyKey);
  let dailyTtlMs = await redisClient.pTTL(dailyKey);
  if (dailyTtlMs < 0) {
    await redisClient.pExpire(dailyKey, DAY_IN_MS);
    dailyTtlMs = DAY_IN_MS;
  }
  const dailyResetAt = now + dailyTtlMs;
  const dailyAllowed = dailyCount <= dailyLimit;

  // Minute key (sliding window using sorted set)
  const minuteKey = getRedisRateLimitKey(identifier, 'minute');
  const minuteWindowStart = now - MINUTE_IN_MS;
  // Remove expired entries
  await redisClient.zRemRangeByScore(minuteKey, 0, minuteWindowStart);
  // Count current entries in window
  const minuteCount = await redisClient.zCard(minuteKey);
  const minuteAllowed = minuteCount < perMinuteLimit;
  let minuteResetAt = now + MINUTE_IN_MS;
  if (minuteAllowed) {
    // Add current request with timestamp as score
    await redisClient.zAdd(minuteKey, { score: now, value: `${now}-${Math.random()}` });
    await redisClient.pExpire(minuteKey, MINUTE_IN_MS);
  } else {
    // Get oldest entry to calculate reset time
    const oldest = await redisClient.zRange(minuteKey, 0, 0, { WITHSCORES: true });
    if (oldest.length > 0) {
      minuteResetAt = parseInt(oldest[1]) + MINUTE_IN_MS;
    }
  }

  // Burst key (token bucket stored as JSON)
  const burstKey = getRedisRateLimitKey(identifier, 'burst');
  let burstData = await redisClient.get(burstKey);
  let burst = burstData ? JSON.parse(burstData) : { tokens: burstLimit, lastRefill: now };
  const refillRate = perMinuteLimit / 60000;
  const elapsed = now - burst.lastRefill;
  burst.tokens = Math.min(burstLimit, burst.tokens + elapsed * refillRate);
  burst.lastRefill = now;

  let burstAllowed = false;
  let burstRemaining = 0;
  if (burst.tokens >= 1) {
    burst.tokens -= 1;
    burstAllowed = true;
    burstRemaining = Math.floor(burst.tokens);
  }
  await redisClient.set(burstKey, JSON.stringify(burst));

  const allowed = dailyAllowed && minuteAllowed && burstAllowed;

  // Calculate retry-after
  let retryAfter = 0;
  if (!allowed) {
    const retryTimes = [];
    if (!dailyAllowed) retryTimes.push(Math.ceil((dailyResetAt - now) / 1000));
    if (!minuteAllowed) retryTimes.push(Math.ceil((minuteResetAt - now) / 1000));
    if (!burstAllowed) retryTimes.push(1);
    retryAfter = retryTimes.length > 0 ? Math.max(...retryTimes) : 0;
  }

  return {
    count: dailyCount,
    resetAt: dailyResetAt,
    allowed,
    remaining: Math.max(0, dailyLimit - dailyCount),
    minuteCount,
    minuteRemaining: Math.max(0, perMinuteLimit - minuteCount),
    minuteResetAt,
    burstRemaining,
    retryAfter
  };
}

/**
 * Increment rate limit (chooses Redis or memory backend)
 */
async function incrementRateLimit(identifier, tier) {
  if (_redisAvailable && redisClient) {
    try {
      return await incrementRedisRateLimit(identifier, tier);
    } catch (err) {
      _redisAvailable = false;
      redisClient = null;
      logger.warn('Rate limiter: Redis request failed; switching to in-memory mode for this instance', { error: err.message });
      logInMemoryFallback('Redis request failed mid-flight');
    }
  }

  return incrementMemoryRateLimit(identifier, tier);
}

function safeEqualHex(left, right) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Check if an API key is valid and get its tier
 */
async function validateApiKey(apiKey) {
  if (!isApiKeyFormatValid(apiKey)) {
    return { valid: false, tier: 'free' };
  }

  try {
    const apiKeyHash = hashApiKey(apiKey);
    let keyRecord = await db.get('SELECT * FROM api_keys WHERE key_hash = $1', [apiKeyHash]);

    if (!keyRecord) {
      keyRecord = await db.get('SELECT * FROM api_keys WHERE key = $1', [apiKey]);
      if (keyRecord) {
        await db.query(
          'UPDATE api_keys SET key_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [apiKeyHash, keyRecord.id]
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
 * Check if a request is within rate limits (daily + per-minute + burst)
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

  const result = await incrementRateLimit(identifier, tier);

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    limit: tier === 'pro' ? PRO_TIER_LIMIT : FREE_TIER_LIMIT,
    retryAfter: result.retryAfter,
    resetAt: result.resetAt,
    tier,
    // Per-minute info
    minuteLimit: tier === 'pro' ? PRO_TIER_PER_MINUTE : FREE_TIER_PER_MINUTE,
    minuteRemaining: result.minuteRemaining,
    minuteResetAt: result.minuteResetAt,
    minuteCount: result.minuteCount,
    // Burst info
    burstLimit: tier === 'pro' ? PRO_TIER_BURST : FREE_TIER_BURST,
    burstRemaining: result.burstRemaining
  };
}

/**
 * Rate limiting middleware factory
 * Returns an Express middleware function
 */
function rateLimiterMiddleware() {
  return async (req, res, next) => {
    // Get API key from header
    const apiKey = req.headers['x-api-key'] || null;

    // Get client IP (hardened)
    const ip = getClientIP(req);

    // Check rate limit
    const status = await checkRateLimit(apiKey, ip);

    // Set rate limit headers on all responses
    res.set('X-RateLimit-Limit', String(status.limit));
    res.set('X-RateLimit-Remaining', String(status.remaining));
    res.set('X-RateLimit-Reset', String(Math.floor(status.resetAt / 1000)));

    // Per-minute headers
    res.set('X-RateLimit-Limit-Minute', String(status.minuteLimit));
    res.set('X-RateLimit-Remaining-Minute', String(status.minuteRemaining));
    res.set('X-RateLimit-Reset-Minute', String(Math.floor(status.minuteResetAt / 1000)));

    // Burst headers
    res.set('X-RateLimit-Burst-Limit', String(status.burstLimit));
    res.set('X-RateLimit-Burst-Remaining', String(status.burstRemaining));

    if (!status.allowed) {
      // Rate limit exceeded
      logger.warn('Rate limit exceeded', {
        tier: status.tier,
        ip,
        dailyCount: status.limit - status.remaining,
        minuteCount: status.minuteCount,
        burstRemaining: status.burstRemaining
      });
      res.set('Retry-After', String(status.retryAfter));
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        status: 429,
        retryAfter: status.retryAfter,
        message: `Too many requests. Daily limit: ${status.limit}/day, Per-minute: ${status.minuteLimit}/min, Burst: ${status.burstLimit}. Try again in ${status.retryAfter} seconds.`,
        limits: {
          daily: { limit: status.limit, remaining: status.remaining, resetAt: status.resetAt },
          minute: { limit: status.minuteLimit, remaining: status.minuteRemaining, resetAt: status.minuteResetAt },
          burst: { limit: status.burstLimit, remaining: status.burstRemaining }
        }
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
    if (now >= entry.daily?.resetAt) {
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
    if (now < entry.daily?.resetAt) {
      activeEntries.push({
        key,
        daily: {
          count: entry.daily.count,
          resetAt: entry.daily.resetAt,
          remaining: Math.max(0, (entry.daily.count > 1000 ? PRO_TIER_LIMIT : FREE_TIER_LIMIT) - entry.daily.count)
        },
        minute: {
          count: entry.minute?.timestamps?.filter(ts => now - ts < MINUTE_IN_MS).length || 0,
          remaining: Math.max(0, (entry.daily.count > 1000 ? PRO_TIER_PER_MINUTE : FREE_TIER_PER_MINUTE) -
            (entry.minute?.timestamps?.filter(ts => now - ts < MINUTE_IN_MS).length || 0))
        },
        burst: {
          remaining: entry.burst ? Math.floor(entry.burst.tokens) : 0,
          limit: entry.daily.count > 1000 ? PRO_TIER_BURST : FREE_TIER_BURST
        }
      });
    }
  }

  return {
    backend: _redisAvailable ? 'redis' : 'memory',
    redisAvailable: _redisAvailable,
    persistenceEnabled: true,
    persistenceFile: PERSISTENCE_FILE,
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

  if (_redisAvailable && redisClient) {
    try {
      const dailyKey = getRedisRateLimitKey(key, 'daily');
      const minuteKey = getRedisRateLimitKey(key, 'minute');
      const burstKey = getRedisRateLimitKey(key, 'burst');
      const normalizedDailyKey = getRedisRateLimitKey(normalizedKey, 'daily');
      const normalizedMinuteKey = getRedisRateLimitKey(normalizedKey, 'minute');
      const normalizedBurstKey = getRedisRateLimitKey(normalizedKey, 'burst');

      await redisClient.del(dailyKey, minuteKey, burstKey);
      if (normalizedKey !== key) {
        await redisClient.del(normalizedDailyKey, normalizedMinuteKey, normalizedBurstKey);
      }
    } catch (err) {
      logger.warn('Failed to reset Redis rate limit entry', { error: err.message });
    }
  }
}

// Make redisAvailable accessible from outside (already declared at line 26)
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
  getClientIP,
  savePersistedStore,
  loadPersistedStore,
  FREE_TIER_LIMIT,
  PRO_TIER_LIMIT,
  FREE_TIER_PER_MINUTE,
  PRO_TIER_PER_MINUTE,
  FREE_TIER_BURST,
  PRO_TIER_BURST
};