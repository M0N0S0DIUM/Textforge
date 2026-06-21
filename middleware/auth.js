const jwt = require('jsonwebtoken');
const logger = require('../logger');

const JWT_SECRET = process.env.JWT_SECRET || 'textforge-jwt-secret-change-in-production';

/**
 * JWT authentication middleware
 * Attaches decoded user to req.user if token is valid
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('Invalid JWT token', { error: err.message });
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth middleware - attaches user if token is present, continues if not
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // Ignore invalid tokens in optional mode
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth, JWT_SECRET };
