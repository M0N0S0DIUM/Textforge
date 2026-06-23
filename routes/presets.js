const express = require('express');
const db = require('../db');
const logger = require('../logger');
const { hashApiKey } = require('../apiKeys');
const { validateApiKey } = require('../rateLimiter');

const router = express.Router();

// Helper: Get customer_id from API key
async function getCustomerIdFromApiKey(apiKey) {
  const validation = await validateApiKey(apiKey);
  if (!validation.valid || !validation.keyHash) {
    return null;
  }
  const keyRecord = await db.get(
    'SELECT customer_id FROM api_keys WHERE key_hash = $1',
    [validation.keyHash]
  );
  return keyRecord?.customer_id || null;
}

// GET /api/presets - List all presets for the authenticated customer
router.get('/presets', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'API key required' });
    }

    const customerId = await getCustomerIdFromApiKey(apiKey);
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Invalid API key' });
    }

    const presets = await db.query(
      'SELECT id, name, actions, description, created_at, updated_at FROM user_presets WHERE customer_id = $1 ORDER BY updated_at DESC',
      [customerId]
    );

    res.json({ success: true, presets: presets.rows });
  } catch (error) {
    logger.error('Error fetching presets', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch presets' });
  }
});

// GET /api/presets/:id - Get a specific preset
router.get('/presets/:id', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'API key required' });
    }

    const customerId = await getCustomerIdFromApiKey(apiKey);
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Invalid API key' });
    }

    const preset = await db.get(
      'SELECT id, name, actions, description, created_at, updated_at FROM user_presets WHERE id = $1 AND customer_id = $2',
      [req.params.id, customerId]
    );

    if (!preset) {
      return res.status(404).json({ success: false, error: 'Preset not found' });
    }

    res.json({ success: true, preset });
  } catch (error) {
    logger.error('Error fetching preset', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch preset' });
  }
});

// POST /api/presets - Create a new preset
router.post('/presets', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'API key required' });
    }

    const customerId = await getCustomerIdFromApiKey(apiKey);
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Invalid API key' });
    }

    const { name, actions, description } = req.body;

    if (!name || !actions || !Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and actions array are required' 
      });
    }

    // Validate all actions exist
    const { getAvailableActions } = require('../transformations');
    const availableActions = getAvailableActions();
    for (const action of actions) {
      if (!availableActions.includes(action)) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid action: ${action}` 
        });
      }
    }

    const result = await db.query(
      `INSERT INTO user_presets (customer_id, name, actions, description) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, actions, description, created_at, updated_at`,
      [customerId, name, JSON.stringify(actions), description || null]
    );

    logger.info('Preset created', { customerId, presetId: result.rows[0].id, name });
    res.status(201).json({ success: true, preset: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ success: false, error: 'Preset name already exists' });
    }
    logger.error('Error creating preset', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create preset' });
  }
});

// PUT /api/presets/:id - Update a preset
router.put('/presets/:id', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'API key required' });
    }

    const customerId = await getCustomerIdFromApiKey(apiKey);
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Invalid API key' });
    }

    const { name, actions, description } = req.body;

    // Validate actions if provided
    if (actions) {
      if (!Array.isArray(actions) || actions.length === 0) {
        return res.status(400).json({ success: false, error: 'Actions must be a non-empty array' });
      }
      const { getAvailableActions } = require('../transformations');
      const availableActions = getAvailableActions();
      for (const action of actions) {
        if (!availableActions.includes(action)) {
          return res.status(400).json({ success: false, error: `Invalid action: ${action}` });
        }
      }
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (actions !== undefined) {
      updates.push(`actions = $${paramIndex++}`);
      values.push(JSON.stringify(actions));
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.params.id);
    values.push(customerId);

    const result = await db.query(
      `UPDATE user_presets SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND customer_id = $${paramIndex} RETURNING id, name, actions, description, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Preset not found' });
    }

    logger.info('Preset updated', { customerId, presetId: req.params.id });
    res.json({ success: true, preset: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'Preset name already exists' });
    }
    logger.error('Error updating preset', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update preset' });
  }
});

// DELETE /api/presets/:id - Delete a preset
router.delete('/presets/:id', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'API key required' });
    }

    const customerId = await getCustomerIdFromApiKey(apiKey);
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Invalid API key' });
    }

    const result = await db.query(
      'DELETE FROM user_presets WHERE id = $1 AND customer_id = $2',
      [req.params.id, customerId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Preset not found' });
    }

    logger.info('Preset deleted', { customerId, presetId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting preset', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to delete preset' });
  }
});

module.exports = router;