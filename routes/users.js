const express = require('express');
const db = require('../db');
const logger = require('../logger');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /users/stats - dashboard usage stats
router.get('/stats', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;

    // Total requests by this user
    const totalRequests = db.prepare(
      'SELECT COUNT(*) as count FROM usage_history WHERE user_id = ?'
    ).get(userId);

    // Requests today
    const requestsToday = db.prepare(
      "SELECT COUNT(*) as count FROM usage_history WHERE user_id = ? AND date(created_at) = date('now')"
    ).get(userId);

    // Most used transformation
    const topAction = db.prepare(
      'SELECT action, COUNT(*) as count FROM usage_history WHERE user_id = ? GROUP BY action ORDER BY count DESC LIMIT 1'
    ).get(userId);

    // Requests per day for the last 7 days
    const dailyUsage = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count
      FROM usage_history
      WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
      GROUP BY day
      ORDER BY day ASC
    `).all(userId);

    // User tier info
    const user = db.prepare('SELECT tier FROM users WHERE id = ?').get(userId);
    const limit = user && user.tier === 'pro' ? 50000 : 1000;

    res.json({
      success: true,
      stats: {
        totalRequests: totalRequests.count,
        requestsToday: requestsToday.count,
        dailyLimit: limit,
        topAction: topAction ? topAction.action : null,
        dailyUsage,
        tier: user ? user.tier : 'free'
      }
    });
  } catch (err) {
    logger.error('Get user stats error', err);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// GET /users/history - transformation history
router.get('/history', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const history = db.prepare(
      'SELECT id, action, input_length, output_length, created_at FROM usage_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(userId, limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM usage_history WHERE user_id = ?').get(userId);

    res.json({ success: true, history, total: total.count, limit, offset });
  } catch (err) {
    logger.error('Get user history error', err);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

module.exports = router;
