const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const logger = require('../logger');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function generateApiKey(tier) {
  const prefix = tier === 'pro' ? 'tf_pro_' : 'tf_free_';
  return prefix + crypto.randomBytes(20).toString('hex');
}

// GET /api/keys - list user's API keys
router.get('/', requireAuth, (req, res) => {
  try {
    const keys = db.prepare(
      'SELECT id, key, name, tier, revoked, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    res.json({ success: true, keys });
  } catch (err) {
    logger.error('List keys error', err);
    res.status(500).json({ success: false, error: 'Failed to fetch API keys' });
  }
});

// POST /api/keys - create a new API key
router.post('/', requireAuth, (req, res) => {
  try {
    const { name } = req.body;

    const user = db.prepare('SELECT tier FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Count existing non-revoked keys
    const keyCount = db.prepare(
      'SELECT COUNT(*) as count FROM api_keys WHERE user_id = ? AND revoked = 0'
    ).get(req.user.id);

    const maxKeys = user.tier === 'pro' ? 10 : 2;
    if (keyCount.count >= maxKeys) {
      return res.status(400).json({
        success: false,
        error: `You can have at most ${maxKeys} active API keys on the ${user.tier} plan`
      });
    }

    const key = generateApiKey(user.tier);
    const keyName = name || `Key ${keyCount.count + 1}`;

    const result = db.prepare(
      'INSERT INTO api_keys (key, user_id, name, tier) VALUES (?, ?, ?, ?)'
    ).run(key, req.user.id, keyName, user.tier);

    const created = db.prepare('SELECT id, key, name, tier, revoked, created_at FROM api_keys WHERE id = ?').get(result.lastInsertRowid);

    logger.info('API key created', { userId: req.user.id, keyId: created.id });
    res.status(201).json({ success: true, key: created });
  } catch (err) {
    logger.error('Create key error', err);
    res.status(500).json({ success: false, error: 'Failed to create API key' });
  }
});

// DELETE /api/keys/:id - revoke an API key
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const keyRecord = db.prepare('SELECT * FROM api_keys WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!keyRecord) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }
    if (keyRecord.revoked) {
      return res.status(400).json({ success: false, error: 'API key is already revoked' });
    }

    db.prepare('UPDATE api_keys SET revoked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

    logger.info('API key revoked', { userId: req.user.id, keyId: id });
    res.json({ success: true, message: 'API key revoked' });
  } catch (err) {
    logger.error('Revoke key error', err);
    res.status(500).json({ success: false, error: 'Failed to revoke API key' });
  }
});

module.exports = router;
