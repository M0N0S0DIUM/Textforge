/**
 * TextForge - Logger Module
 * 
 * Centralized structured logging for debugging and monitoring.
 * Respects NODE_ENV to adjust verbosity.
 */

const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'error' : 'info');

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = LEVELS[LOG_LEVEL] || LEVELS.info;

/**
 * Format timestamp as ISO string
 * @returns {string} ISO timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Log an error message
 * @param {string} message - Error message
 * @param {Error|object} err - Error object or context
 */
function error(message, err) {
  if (currentLevel >= LEVELS.error) {
    const timestamp = getTimestamp();
    console.error(`[${timestamp}] ERROR: ${message}`, err || '');
  }
}

/**
 * Log a warning message
 * @param {string} message - Warning message
 * @param {object} context - Additional context
 */
function warn(message, context) {
  if (currentLevel >= LEVELS.warn) {
    const timestamp = getTimestamp();
    console.warn(`[${timestamp}] WARN: ${message}`, context || '');
  }
}

/**
 * Log an info message
 * @param {string} message - Info message
 * @param {object} context - Additional context
 */
function info(message, context) {
  if (currentLevel >= LEVELS.info) {
    const timestamp = getTimestamp();
    console.log(`[${timestamp}] INFO: ${message}`, context || '');
  }
}

/**
 * Log a debug message
 * @param {string} message - Debug message
 * @param {object} context - Additional context
 */
function debug(message, context) {
  if (currentLevel >= LEVELS.debug) {
    const timestamp = getTimestamp();
    console.log(`[${timestamp}] DEBUG: ${message}`, context || '');
  }
}

module.exports = {
  error,
  warn,
  info,
  debug
};
