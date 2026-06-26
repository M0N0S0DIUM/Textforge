const express = require('express');
const db = require('../db');
const logger = require('../logger');
const { hashApiKey } = require('../apiKeys');
const { 
  validateApiKey, 
  getClientIP,
  FREE_TIER_LIMIT,
  PRO_TIER_LIMIT,
  FREE_TIER_PER_MINUTE,
  PRO_TIER_PER_MINUTE
} = require('../rateLimiter');

const router = express.Router();

const crypto = require('crypto');

// Helper: Get api_key_hash from API key, or ip_hash for anonymous users
// Uses full SHA-256 hash for consistency with rate limiter
async function getIdentifierFromRequest(req) {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey) {
    const validation = await validateApiKey(apiKey);
    if (validation.valid && validation.keyHash) {
      // Return just the hash (matches what's stored in request_logs.api_key_hash)
      return { type: 'api_key', identifier: validation.keyHash };
    }
  }
  
  // For anonymous users, use IP hash (stored as just the hash in database)
  // Use hardened IP extraction and full SHA-256 hash (not truncated)
  const ip = getClientIP(req);
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
  return { type: 'ip', identifier: ipHash };
}

// GET /api/analytics - Get analytics for the authenticated API key or IP
// Query params: period (7d, 30d, 90d, all), startDate, endDate
router.get('/analytics', async (req, res) => {
  try {
    const identifier = await getIdentifierFromRequest(req);
    if (!identifier) {
      return res.status(401).json({ success: false, error: 'Unable to identify user' });
    }

    const { period = '30d', startDate, endDate } = req.query;
    let dateFilter = '';
    const params = [identifier.identifier];
    let paramIndex = 2;

    if (startDate && endDate) {
      dateFilter = `AND created_at >= ${paramIndex} AND created_at <= ${paramIndex+1}`;
      params.push(startDate, endDate);
      paramIndex += 2;
    } else {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : null;
      if (days) {
        dateFilter = `AND created_at >= CURRENT_DATE - INTERVAL '${days} days'`;
      }
    }

    // Get daily analytics for the period from request_logs since daily_analytics might be empty
    const dailyWhereClause = 'WHERE api_key_hash = $1';
    const dailyParams = [identifier.identifier, ...params.slice(1)];
    const dailyResult = await db.query(
      `SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as total_requests,
        COALESCE(SUM(CASE WHEN action IS NOT NULL THEN 1 ELSE jsonb_array_length(actions) END), 0) as total_transformations,
        COALESCE(SUM(latency_ms), 0) as total_latency_ms,
        COALESCE(SUM(request_size_bytes), 0) as total_request_bytes,
        COALESCE(SUM(response_size_bytes), 0) as total_response_bytes,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
       FROM request_logs ${dailyWhereClause} ${dateFilter}
       GROUP BY DATE_TRUNC('day', created_at)
       ORDER BY date ASC`,
      dailyParams
    );

    // Calculate aggregates
    let summary = {
      totalRequests: 0,
      totalTransformations: 0,
      avgLatencyMs: 0,
      totalRequestBytes: 0,
      totalResponseBytes: 0,
      totalErrors: 0,
      errorRate: 0,
      actionBreakdown: {}
    };

    if (dailyResult.rows.length > 0) {
      const actionBreakdown = {};
      let totalLatency = 0;
      let requestCount = 0;

      for (const row of dailyResult.rows) {
        summary.totalRequests += row.total_requests;
        summary.totalTransformations += row.total_transformations;
        totalLatency += row.total_latency_ms;
        requestCount += row.total_requests;
        summary.totalRequestBytes += row.total_request_bytes;
        summary.totalResponseBytes += row.total_response_bytes;
        summary.totalErrors += row.errors;

        // Merge action breakdowns
        for (const [action, count] of Object.entries(row.action_breakdown || {})) {
          actionBreakdown[action] = (actionBreakdown[action] || 0) + count;
        }
      }

      summary.avgLatencyMs = requestCount > 0 ? Math.round(totalLatency / requestCount) : 0;
      summary.errorRate = summary.totalRequests > 0 
        ? Math.round((summary.totalErrors / summary.totalRequests) * 10000) / 100 
        : 0;
      summary.actionBreakdown = actionBreakdown;
    }

    // Get top actions for the period
    const topActionsWhereClause = 'WHERE api_key_hash = $1';
    const topActionsParams = [identifier.identifier, ...params.slice(1)];
    const topActionsResult = await db.query(
      `SELECT action, COUNT(*) as count, AVG(latency_ms) as avg_latency_ms
       FROM request_logs ${topActionsWhereClause} ${dateFilter}
       GROUP BY action
       ORDER BY count DESC
       LIMIT 20`,
      topActionsParams
    );

    // Get recent requests (last 50)
    const recentWhereClause = 'WHERE api_key_hash = $1';
    const recentParams = [identifier.identifier, ...params.slice(1)];
    const recentResult = await db.query(
      `SELECT action, actions, status_code, latency_ms, created_at
       FROM request_logs ${recentWhereClause} ${dateFilter}
       ORDER BY created_at DESC
       LIMIT 50`,
      recentParams
    );

    res.json({
      success: true,
      analytics: {
        summary,
        daily: dailyResult.rows,
        topActions: topActionsResult.rows,
        recentRequests: recentResult.rows
      }
    });
  } catch (error) {
    logger.error('Error fetching analytics', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

// GET /api/analytics/usage - Simplified usage summary for dashboard cards
router.get('/analytics/usage', async (req, res) => {
  try {
    const identifier = await getIdentifierFromRequest(req);
    if (!identifier) {
      return res.status(401).json({ success: false, error: 'Unable to identify user' });
    }

    // Query request_logs directly since daily_analytics might be empty
    // Today (from request_logs) - anonymous users use IP hash in api_key_hash column
    const todayWhereClause = identifier.type === 'api_key'
      ? 'WHERE api_key_hash = $1 AND created_at::date = CURRENT_DATE'
      : 'WHERE api_key_hash = $1 AND created_at::date = CURRENT_DATE';
    const todayParams = [identifier.identifier];
    const today = await db.query(
      `SELECT
        COUNT(*) as requests_today,
        COALESCE(SUM(CASE WHEN action IS NOT NULL THEN 1 ELSE jsonb_array_length(actions) END), 0) as transforms_today
       FROM request_logs ${todayWhereClause}`,
      todayParams
    );

    // Current month (from request_logs)
    const currentMonthWhereClause = identifier.type === 'api_key'
      ? "WHERE api_key_hash = $1 AND created_at >= DATE_TRUNC('month', CURRENT_DATE)"
      : "WHERE api_key_hash = $1 AND created_at >= DATE_TRUNC('month', CURRENT_DATE)";
    const currentMonthParams = [identifier.identifier];
    const currentMonth = await db.query(
      `SELECT
        COUNT(*) as requests_this_month,
        COALESCE(SUM(CASE WHEN action IS NOT NULL THEN 1 ELSE jsonb_array_length(actions) END), 0) as transforms_this_month
       FROM request_logs ${currentMonthWhereClause}`,
      currentMonthParams
    );

    // Last month (from request_logs)
    const lastMonthWhereClause = identifier.type === 'api_key'
      ? `WHERE api_key_hash = $1
       AND created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
       AND created_at < DATE_TRUNC('month', CURRENT_DATE)`
      : `WHERE api_key_hash = $1
       AND created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
       AND created_at < DATE_TRUNC('month', CURRENT_DATE)`;
    const lastMonthParams = [identifier.identifier];
    const lastMonth = await db.query(
      `SELECT 
        COUNT(*) as requests_last_month
       FROM request_logs ${lastMonthWhereClause}`,
      lastMonthParams
    );

    // Get rate limit info from rate limiter
    const { getStats: getRateStats } = require('../rateLimiter');
    const rateStats = getRateStats();
    
    let rateLimitInfo = null;
    
    if (identifier.type === 'api_key') {
      // Rate limiter stores keys with 'api:' prefix
      const rateLimitKey = `api:${identifier.identifier}`;
      const keyEntry = rateStats.entries?.find(e => e.key === rateLimitKey);
      if (keyEntry) {
        const isPro = keyEntry.count > 25000; // heuristic based on daily count
        rateLimitInfo = {
          daily: {
            limit: isPro ? PRO_TIER_LIMIT : FREE_TIER_LIMIT,
            used: keyEntry.count,
            remaining: Math.max(0, (isPro ? PRO_TIER_LIMIT : FREE_TIER_LIMIT) - keyEntry.count),
            resetAt: keyEntry.resetAt
          },
          minute: {
            limit: isPro ? PRO_TIER_PER_MINUTE : FREE_TIER_PER_MINUTE,
            used: keyEntry.minuteCount || 0,
            remaining: keyEntry.minuteRemaining || 0,
            resetAt: keyEntry.minuteResetAt || keyEntry.resetAt
          },
          burst: {
            remaining: keyEntry.burstRemaining || 0
          }
        };
      }
    } else {
      // For IP-based usage, get from rate limiter using ip:${ipHash} format
      const ipRateLimitKey = `ip:${identifier.identifier}`;
      const keyEntry = rateStats.entries?.find(e => e.key === ipRateLimitKey);
      if (keyEntry) {
        rateLimitInfo = {
          daily: {
            limit: FREE_TIER_LIMIT,
            used: keyEntry.count,
            remaining: Math.max(0, FREE_TIER_LIMIT - keyEntry.count),
            resetAt: keyEntry.resetAt
          },
          minute: {
            limit: FREE_TIER_PER_MINUTE,
            used: keyEntry.minuteCount || 0,
            remaining: keyEntry.minuteRemaining || 0,
            resetAt: keyEntry.minuteResetAt || keyEntry.resetAt
          },
          burst: {
            remaining: keyEntry.burstRemaining || 0
          }
        };
      }
    }

    res.json({
      success: true,
      usage: {
        today: parseNumericFields(today.rows[0]),
        thisMonth: parseNumericFields(currentMonth.rows[0]),
        lastMonth: parseNumericFields(lastMonth.rows[0]),
        rateLimit: rateLimitInfo
      }
    });
  } catch (error) {
    logger.error('Error fetching usage', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch usage' });
  }
});

// Helper: Parse numeric string fields from PostgreSQL results to integers
function parseNumericFields(obj) {
  if (!obj) return obj;
  const parsed = { ...obj };
  for (const key of Object.keys(parsed)) {
    const val = parsed[key];
    if (typeof val === 'string' && /^\d+$/.test(val)) {
      parsed[key] = parseInt(val, 10);
    }
  }
  return parsed;
}


// Admin: Trigger daily rollup manually (for testing)
router.post('/analytics/rollup', async (req, res) => {
  try {
    await rollupDailyAnalytics();
    res.json({ success: true, message: 'Daily rollup completed' });
  } catch (error) {
    logger.error('Error running rollup', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to run rollup' });
  }
});

// Daily rollup function - call via cron or scheduler
async function rollupDailyAnalytics() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  // Aggregate request_logs from yesterday into daily_analytics
  await db.query(
    `INSERT INTO daily_analytics (api_key_hash, date, total_requests, total_transformations, total_latency_ms, total_request_bytes, total_response_bytes, errors, action_breakdown)
     SELECT 
       api_key_hash,
       $1::date,
       COUNT(*) as total_requests,
       SUM(CASE WHEN action IS NOT NULL AND actions IS NULL THEN 1 ELSE jsonb_array_length(actions) END) as total_transformations,
       SUM(latency_ms) as total_latency_ms,
       COALESCE(SUM(request_size_bytes), 0) as total_request_bytes,
       COALESCE(SUM(response_size_bytes), 0) as total_response_bytes,
       SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors,
       COALESCE(
         jsonb_object_agg(action, action_count),
         '{}'
       ) as action_breakdown
     FROM (
       SELECT 
         api_key_hash,
         action,
         actions,
         latency_ms,
         request_size_bytes,
         response_size_bytes,
         status_code,
         COUNT(*) as action_count
       FROM request_logs
       WHERE created_at::date = $1::date
       GROUP BY api_key_hash, action, actions, latency_ms, request_size_bytes, response_bytes, status_code
     ) sub
     GROUP BY api_key_hash
     ON CONFLICT (api_key_hash, date) DO UPDATE SET
       total_requests = EXCLUDED.total_requests,
       total_transformations = EXCLUDED.total_transformations,
       total_latency_ms = EXCLUDED.total_latency_ms,
       total_request_bytes = EXCLUDED.total_request_bytes,
       total_response_bytes = EXCLUDED.total_response_bytes,
       errors = EXCLUDED.errors,
       action_breakdown = EXCLUDED.action_breakdown,
       updated_at = CURRENT_TIMESTAMP`,
    [dateStr]
  );

  logger.info('Daily analytics rollup completed', { date: dateStr });
}

module.exports = { router, rollupDailyAnalytics };
