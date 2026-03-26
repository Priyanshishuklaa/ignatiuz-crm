// ============================================================
// EXPRESS SERVER — Main entry point
// Connects all routes and starts the API on port 5000
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize database (creates tables + seeds data)
const db = require('./db');

// Import route modules
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const clientRoutes = require('./routes/clients');
const opportunityRoutes = require('./routes/opportunities');
const invoiceRoutes = require('./routes/invoices');
const dashboardRoutes = require('./routes/dashboard');

const { initMailer } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// MIDDLEWARE — Applied to every request
// ============================================================

// Enable CORS so the React frontend (port 5173) can call the API
app.use(cors());

// Parse JSON request bodies (for POST/PUT requests)
app.use(express.json());

// ============================================================
// ROUTES — Each module handles a specific resource
// ============================================================

// Health check — useful for monitoring/deployment
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount route modules at their respective paths
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ============================================================
// ERROR HANDLING — Catch-all for unhandled errors
// ============================================================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, async () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║     Ignatiuz CRM API Server        ║
  ║     http://localhost:${PORT}            ║
  ╚══════════════════════════════════════╝
  `);
  // Initialize email service (Ethereal test SMTP)
  await initMailer();
});
