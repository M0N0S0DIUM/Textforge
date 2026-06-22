const express = require('express');
const { resetRateLimit } = require('../rateLimiter');

const router = express.Router();

/**
 * POST /admin/reset-rate-limit - Reset rate limit for a specific key (testing only)
 * 
 * This endpoint is meant for testing/development purposes to reset rate limits.
 * In production, you should restrict access to trusted IPs or remove it entirely.
 */
router.post('/reset-rate-limit', async (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      success: false,
      error: 'Rate limit reset endpoint is only available in development mode',
      status: 403
    });
  }
  
  const { identifier } = req.body;
  
  if (!identifier) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: identifier (API key or IP to reset)',
      status: 400
    });
  }
  
  try {
    await resetRateLimit(identifier);
    
    res.json({
      success: true,
      message: `Rate limit reset for identifier: ${identifier}`,
      identifier
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to reset rate limit',
      status: 500,
      details: err.message
    });
  }
});

/**
 * GET /admin/health - Detailed health check for development
 */
router.get('/health', async (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      success: false,
      error: 'Detailed health endpoint is only available in development mode',
      status: 403
    });
  }
  
  try {
    const dbStatus = await checkDatabaseHealth();
    
    res.json({
      success: true,
      database: dbStatus,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      status: 500
    });
  }
});

/**
 * Check database health
 */
async function checkDatabaseHealth() {
  try {
    const db = require('../db');
    await db.get('SELECT 1');
    return { connected: true, status: 'healthy' };
  } catch (err) {
    return { 
      connected: false, 
      status: 'unhealthy',
      error: err.message
    };
  }
}

module.exports = router;
