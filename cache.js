/**
 * TextForge - Cache Module
 * 
 * Provides a Redis-backed cache wrapper with automatic fallback
 * to no-op caching when Redis is unavailable.
 * 
 * Cache keys are generated from transformation parameters.
 * TTL is configurable (default: 1 hour).
 */

const MAX_CACHE_SIZE = 1000; // Maximum number of entries in in-memory cache
const DEFAULT_TTL = 3600; // Default TTL in seconds (1 hour)

// In-memory cache as fallback (Map for O(1) lookups)
const memoryCache = new Map();

let redisClient = null;
let redisAvailable = false;

/**
 * Initialize Redis client if REDIS_URL is provided
 * @returns {Promise<boolean>} Whether Redis is available
 */
async function initRedis() {
  try {
    // Dynamically import redis to avoid crash if not installed
    const redis = await import('redis');
    const url = process.env.REDIS_URL;
    
    if (!url) {
      redisAvailable = false;
      return false;
    }
    
    redisClient = redis.createClient({ url });
    
    redisClient.on('error', (err) => {
      // Redis error - fall back to no-op
      redisAvailable = false;
      redisClient = null;
    });
    
    redisClient.on('connect', () => {
      redisAvailable = true;
    });
    
    await redisClient.connect();
    redisAvailable = true;
    return true;
  } catch (err) {
    redisAvailable = false;
    redisClient = null;
    return false;
  }
}

/**
 * Generate a cache key from transformation parameters
 * @param {string} text - The input text
 * @param {string} action - The transformation action
 * @param {object} params - Additional parameters
 * @returns {string} Cache key
 */
function generateCacheKey(text, action, params = {}) {
  const paramStr = Object.entries(params)
    .sort()
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `tf:${action}:${Buffer.from(text).length}:${paramStr}`;
}

/**
 * Get a cached value
 * @param {string} key - Cache key
 * @returns {any|null} Cached value or null
 */
async function get(key) {
  // Try Redis first
  if (redisAvailable && redisClient) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      // Redis failed, fall through to memory cache
    }
  }
  
  // Fall back to in-memory cache
  const entry = memoryCache.get(key);
  if (!entry) return null;
  
  // Check if entry has expired
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  
  return entry.value;
}

/**
 * Set a cached value
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 */
async function set(key, value, ttl = DEFAULT_TTL) {
  const entry = {
    value,
    expiresAt: Date.now() + (ttl * 1000)
  };
  
  // Try Redis first
  if (redisAvailable && redisClient) {
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
      return;
    } catch {
      // Redis failed, fall through to memory cache
    }
  }
  
  // Fall back to in-memory cache
  // Evict oldest entry if cache is full
  if (memoryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
  
  memoryCache.set(key, entry);
}

/**
 * Delete a cached value
 * @param {string} key - Cache key
 */
async function del(key) {
  if (redisAvailable && redisClient) {
    try {
      await redisClient.del(key);
    } catch {
      // Ignore Redis errors
    }
  }
  memoryCache.delete(key);
}

/**
 * Clear all cached values
 */
async function clear() {
  if (redisAvailable && redisClient) {
    try {
      await redisClient.flushDb();
    } catch {
      // Ignore Redis errors
    }
  }
  memoryCache.clear();
}

/**
 * Get cache statistics
 * @returns {object} Cache statistics
 */
function getStats() {
  return {
    redisAvailable,
    memoryCacheSize: memoryCache.size,
    maxCacheSize: MAX_CACHE_SIZE
  };
}

/**
 * Check if caching is available
 * @returns {boolean} Whether any caching backend is available
 */
function isAvailable() {
  return redisAvailable || memoryCache.size > 0;
}

module.exports = {
  initRedis,
  get,
  set,
  del,
  clear,
  generateCacheKey,
  getStats,
  isAvailable,
  DEFAULT_TTL,
  MAX_CACHE_SIZE
};
