const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const logger = require('../logger');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// POST /auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)'
    ).run(email.toLowerCase(), passwordHash, name || null);

    const user = db.prepare('SELECT id, email, name, tier, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);

    const token = jwt.sign(
      { id: user.id, email: user.email, tier: user.tier },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.info('User registered', { userId: user.id, email: user.email });

    res.status(201).json({ success: true, token, user });
  } catch (err) {
    logger.error('Signup error', err);
    res.status(500).json({ success: false, error: 'Failed to create account' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, tier: user.tier },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.info('User logged in', { userId: user.id });

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, tier: user.tier }
    });
  } catch (err) {
    logger.error('Login error', err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// GET /auth/me
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, name, tier, stripe_customer_id, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (err) {
    logger.error('Get profile error', err);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

// PUT /auth/profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, error: 'Current password required to set a new password' });
      }
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      }

      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) {
        return res.status(401).json({ success: false, error: 'Current password is incorrect' });
      }

      const newHash = await bcrypt.hash(newPassword, 12);
      updates.push('password_hash = ?');
      params.push(newHash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT id, email, name, tier, created_at FROM users WHERE id = ?').get(req.user.id);
    res.json({ success: true, user: updated });
  } catch (err) {
    logger.error('Update profile error', err);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

module.exports = router;
