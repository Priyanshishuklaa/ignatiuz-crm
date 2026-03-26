// ============================================================
// EXPRESS SERVER — Main entry point
// Connects all routes and starts the API
// ============================================================

// Load environment variables from .env FIRST (before any other imports)
require('dotenv').config();

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
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================================
// MIDDLEWARE — Applied to every request
// ============================================================

// CORS — In production the frontend is served from the same origin,
// so we only need CORS for development (Vite on port 5173)
app.use(cors({
  origin: NODE_ENV === 'production'
    ? true   // same-origin, allow all (frontend served from same server)
    : ['http://localhost:5173', 'http://localhost:5000'],
  credentials: true
}));

// Parse JSON request bodies (for POST/PUT requests)
app.use(express.json());

// ============================================================
// API ROUTES — Each module handles a specific resource
// ============================================================

// Health check — useful for monitoring/deployment
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', environment: NODE_ENV, timestamp: new Date().toISOString() });
});

// Mount route modules at their respective paths
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ============================================================
// PRODUCTION — Serve React frontend static files
// In production, the built React app lives in ../client/dist
// ============================================================
if (NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');

  // Serve static assets (JS, CSS, images)
  app.use(express.static(clientBuildPath));

  // Catch-all: serve index.html for any non-API route
  // This enables React Router's client-side routing to work
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

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
  ║       Ignatiuz CRM Server           ║
  ║   http://localhost:${PORT}              ║
  ║   Environment: ${NODE_ENV.padEnd(18)}║
  ╚══════════════════════════════════════╝
  `);
  // Initialize email service (Ethereal test SMTP)
  await initMailer();
});

