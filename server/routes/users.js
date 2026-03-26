// ============================================================
// USER ROUTES — Admin-only user management
// GET    /api/users      — List all users
// POST   /api/users      — Create new user (admin only)
// PUT    /api/users/:id   — Update user (admin only)
// DELETE /api/users/:id   — Delete user (admin only)
// ============================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken, adminOnly } = require('../middleware');
const { sendWelcomeEmail } = require('../mailer');

const router = express.Router();

// All user routes require authentication
router.use(authenticateToken);

// ============================================================
// GET /api/users — List all users
// Admin sees all users, non-admin sees limited info
// ============================================================
router.get('/', (req, res) => {
  const users = db.prepare(`
    SELECT id, name, email, role, phone, department, designation, is_active, created_at, updated_at 
    FROM users ORDER BY created_at DESC
  `).all();

  res.json(users);
});

// ============================================================
// GET /api/users/:id — Get single user
// ============================================================
router.get('/:id', (req, res) => {
  const user = db.prepare(`
    SELECT id, name, email, role, phone, department, designation, is_active, created_at, updated_at 
    FROM users WHERE id = ?
  `).get(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  res.json(user);
});

// ============================================================
// POST /api/users — Create new user (admin only)
// Hashes the password before storing
// ============================================================
router.post('/', adminOnly, async (req, res) => {
  const { name, email, password, role, phone, department, designation } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  // Check for duplicate email
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'A user with this email already exists.' });
  }

  // Hash password before storing (NEVER store plain text passwords!)
  const hashedPassword = bcrypt.hashSync(password, 10);

  const result = db.prepare(`
    INSERT INTO users (name, email, password, role, phone, department, designation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, email, hashedPassword, role || 'client', phone || null, department || null, designation || null);

  // Return the created user (without password)
  const user = db.prepare('SELECT id, name, email, role, phone, department, designation, is_active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);

  // 📧 Send welcome email with credentials
  const emailPreview = await sendWelcomeEmail(user, password);

  res.status(201).json({ ...user, emailPreview });
});

// ============================================================
// PUT /api/users/:id — Update user (admin only)
// Can update name, email, role, etc. Password update optional.
// ============================================================
router.put('/:id', adminOnly, (req, res) => {
  const { name, email, password, role, phone, department, designation, is_active } = req.body;
  const userId = req.params.id;

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!existing) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Check email uniqueness (exclude current user)
  if (email && email !== existing.email) {
    const emailExists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
    if (emailExists) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
  }

  // Build update — only update fields that are provided
  const updates = {
    name: name || existing.name,
    email: email || existing.email,
    role: role || existing.role,
    phone: phone !== undefined ? phone : existing.phone,
    department: department !== undefined ? department : existing.department,
    designation: designation !== undefined ? designation : existing.designation,
    is_active: is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active
  };

  // Only hash and update password if a new one is provided
  if (password) {
    updates.password = bcrypt.hashSync(password, 10);
    db.prepare(`
      UPDATE users SET name=?, email=?, password=?, role=?, phone=?, department=?, designation=?, is_active=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(updates.name, updates.email, updates.password, updates.role, updates.phone, updates.department, updates.designation, updates.is_active, userId);
  } else {
    db.prepare(`
      UPDATE users SET name=?, email=?, role=?, phone=?, department=?, designation=?, is_active=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(updates.name, updates.email, updates.role, updates.phone, updates.department, updates.designation, updates.is_active, userId);
  }

  const user = db.prepare('SELECT id, name, email, role, phone, department, designation, is_active, created_at, updated_at FROM users WHERE id = ?').get(userId);
  res.json(user);
});

// ============================================================
// DELETE /api/users/:id — Delete user (admin only)
// Cannot delete yourself!
// ============================================================
router.delete('/:id', adminOnly, (req, res) => {
  const userId = parseInt(req.params.id);

  // Prevent self-deletion
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account.' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.json({ message: 'User deleted successfully.' });
});

module.exports = router;
