// ============================================================
// AUTH ROUTES — Login and Profile
// POST /api/auth/login — Authenticate user
// GET  /api/auth/me    — Get current user's profile
// ============================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateToken, JWT_SECRET } = require('../middleware');
const { sendLoginNotification } = require('../mailer');

const router = express.Router();

// ============================================================
// POST /api/auth/login
// Takes email + password, returns JWT token if valid
// ============================================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  // Find user by email
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Check if user account is active
  if (!user.is_active) {
    return res.status(401).json({ error: 'Account is deactivated. Contact admin.' });
  }

  // Compare provided password with stored hash
  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Create JWT token with user info as payload (valid 24h)
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  // 📧 Send login notification email (async, non-blocking)
  const emailPreview = await sendLoginNotification(user);

  // Return token + user info (never send password back!)
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      designation: user.designation
    },
    emailPreview  // Ethereal preview URL (for demo)
  });
});

// ============================================================
// GET /api/auth/me
// Returns the currently logged-in user's profile
// Uses the authenticateToken middleware — must be logged in
// ============================================================
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, phone, department, designation, is_active, created_at FROM users WHERE id = ?').get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  res.json(user);
});

module.exports = router;
