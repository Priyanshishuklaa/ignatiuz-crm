// ============================================================
// DASHBOARD ROUTES — Aggregated stats for the homepage
// Provides different data based on user role
// ============================================================

const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware');

const router = express.Router();
router.use(authenticateToken);

// ============================================================
// GET /api/dashboard — Get dashboard statistics
// Admin: full stats. Client/Employee: limited to assigned data.
// ============================================================
router.get('/', (req, res) => {
  if (req.user.role === 'admin') {
    // ---- ADMIN DASHBOARD ----

    // Revenue from paid invoices
    const revenueStats = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as totalRevenue,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paidCount,
        COALESCE(SUM(CASE WHEN status IN ('sent', 'draft', 'partially_paid') THEN total_amount ELSE 0 END), 0) as pendingRevenue,
        COALESCE(SUM(CASE WHEN status = 'overdue' THEN total_amount ELSE 0 END), 0) as overdueRevenue,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdueCount,
        COUNT(*) as totalInvoices
      FROM invoices
    `).get();

    // Client stats
    const clientStats = db.prepare(`
      SELECT 
        COUNT(*) as totalClients,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as activeClients,
        (SELECT COUNT(*) FROM contacts) as totalContacts
      FROM clients
    `).get();

    // Pipeline stats (only open opportunities)
    const pipelineStats = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN stage NOT IN ('closed_won', 'closed_lost') THEN value ELSE 0 END), 0) as pipelineValue,
        COALESCE(SUM(CASE WHEN stage NOT IN ('closed_won', 'closed_lost') THEN value * probability / 100.0 ELSE 0 END), 0) as weightedPipeline,
        COUNT(CASE WHEN stage NOT IN ('closed_won', 'closed_lost') THEN 1 END) as openCount,
        COUNT(CASE WHEN stage = 'closed_won' THEN 1 END) as wonCount,
        COUNT(*) as totalOpportunities
      FROM opportunities
    `).get();

    // Opportunities by stage (for pipeline chart)
    const opportunityStages = db.prepare(`
      SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as total_value
      FROM opportunities
      GROUP BY stage
      ORDER BY 
        CASE stage 
          WHEN 'prospecting' THEN 1
          WHEN 'qualification' THEN 2
          WHEN 'needs_analysis' THEN 3
          WHEN 'proposal' THEN 4
          WHEN 'negotiation' THEN 5
          WHEN 'closed_won' THEN 6
          WHEN 'closed_lost' THEN 7
        END
    `).all();

    // Top clients by revenue
    const topClients = db.prepare(`
      SELECT c.id, c.client_name, c.company_name,
        COUNT(i.id) as invoice_count,
        COALESCE(SUM(i.total_amount), 0) as total_revenue
      FROM clients c
      LEFT JOIN invoices i ON c.id = i.client_id AND i.status = 'paid'
      GROUP BY c.id
      HAVING total_revenue > 0
      ORDER BY total_revenue DESC
      LIMIT 5
    `).all();

    // Recent opportunities
    const recentOpportunities = db.prepare(`
      SELECT o.id, o.opportunity_name, o.stage, o.value,
        c.client_name, c.company_name
      FROM opportunities o
      LEFT JOIN clients c ON o.client_id = c.id
      ORDER BY o.updated_at DESC LIMIT 5
    `).all();

    // Recent invoices
    const recentInvoices = db.prepare(`
      SELECT i.id, i.invoice_number, i.status, i.total_amount, i.due_date,
        c.client_name, c.company_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      ORDER BY i.created_at DESC LIMIT 5
    `).all();

    res.json({
      ...revenueStats,
      ...clientStats,
      ...pipelineStats,
      opportunityStages,
      topClients,
      recentOpportunities,
      recentInvoices
    });

  } else {
    // ---- CLIENT/EMPLOYEE DASHBOARD ----
    // Only stats for their assigned data

    const myClients = db.prepare('SELECT COUNT(*) as count FROM clients WHERE assigned_user_id = ?').get(req.user.id);
    const myOpportunities = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as total_value
      FROM opportunities o
      JOIN clients c ON o.client_id = c.id
      WHERE c.assigned_user_id = ?
    `).get(req.user.id);
    const myInvoices = db.prepare(`
      SELECT COUNT(*) as count, 
        COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END), 0) as revenue
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE c.assigned_user_id = ?
    `).get(req.user.id);

    res.json({
      totalClients: myClients.count,
      totalOpportunities: myOpportunities.count,
      pipelineValue: myOpportunities.total_value,
      totalInvoices: myInvoices.count,
      totalRevenue: myInvoices.revenue
    });
  }
});

module.exports = router;
