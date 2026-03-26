// ============================================================
// MIDDLEWARE — Authentication & Authorization
// These are "gatekeepers" that run BEFORE your route handlers.
// ============================================================

const jwt = require('jsonwebtoken');

// Secret key for signing JWT tokens
// Reads from .env file; falls back to default for dev convenience
const JWT_SECRET = process.env.JWT_SECRET || 'crm-pro-secret-key-2026';

// ============================================================
// authenticateToken — Verifies the user is logged in
// Runs on every protected route
// ============================================================
function authenticateToken(req, res, next) {
  // JWT tokens are sent in the "Authorization" header
  // Format: "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // No token? User isn't logged in
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // jwt.verify checks if the token is valid and not expired
    // If valid, it returns the decoded payload (user id, email, role)
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user info to the request object
    next();             // Continue to the actual route handler
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// ============================================================
// adminOnly — Ensures only admins can perform this action
// Used for: creating users, editing clients, deleting records
// ============================================================
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
}

module.exports = { authenticateToken, adminOnly, JWT_SECRET };
