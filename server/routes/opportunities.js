// ============================================================
// OPPORTUNITY ROUTES — Sales pipeline management
// Tracks deals through 7 stages: Prospecting → Closed Won/Lost
// Auto-sets probability based on stage
// ============================================================

const express = require('express');
const db = require('../db');
const { authenticateToken, adminOnly } = require('../middleware');

const router = express.Router();
router.use(authenticateToken);

// Stage → Probability mapping
// This is the "magic" — when you move a deal to a stage,
// the probability of winning auto-updates
const STAGE_PROBABILITY = {
  prospecting: 10,
  qualification: 20,
  needs_analysis: 40,
  proposal: 60,
  negotiation: 80,
  closed_won: 100,
  closed_lost: 0
};

// ============================================================
// GET /api/opportunities — List all opportunities
// ============================================================
router.get('/', (req, res) => {
  let opportunities;

  if (req.user.role === 'admin') {
    opportunities = db.prepare(`
      SELECT o.*, 
        c.client_name, c.company_name,
        u.name as assigned_user_name,
        ct.first_name || ' ' || ct.last_name as contact_name
      FROM opportunities o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.assigned_user_id = u.id
      LEFT JOIN contacts ct ON o.contact_id = ct.id
      ORDER BY o.created_at DESC
    `).all();
  } else {
    // Non-admin: only opportunities for their assigned clients
    opportunities = db.prepare(`
      SELECT o.*, 
        c.client_name, c.company_name,
        u.name as assigned_user_name,
        ct.first_name || ' ' || ct.last_name as contact_name
      FROM opportunities o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN users u ON o.assigned_user_id = u.id
      LEFT JOIN contacts ct ON o.contact_id = ct.id
      WHERE c.assigned_user_id = ?
      ORDER BY o.created_at DESC
    `).all(req.user.id);
  }

  res.json(opportunities);
});

// ============================================================
// GET /api/opportunities/:id — Get opportunity detail
// ============================================================
router.get('/:id', (req, res) => {
  const opp = db.prepare(`
    SELECT o.*, 
      c.client_name, c.company_name,
      u.name as assigned_user_name,
      ct.first_name || ' ' || ct.last_name as contact_name
    FROM opportunities o
    LEFT JOIN clients c ON o.client_id = c.id
    LEFT JOIN users u ON o.assigned_user_id = u.id
    LEFT JOIN contacts ct ON o.contact_id = ct.id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!opp) {
    return res.status(404).json({ error: 'Opportunity not found.' });
  }

  res.json(opp);
});

// ============================================================
// POST /api/opportunities — Create opportunity (admin only)
// Auto-sets probability based on selected stage
// ============================================================
router.post('/', adminOnly, (req, res) => {
  const { opportunity_name, client_id, contact_id, assigned_user_id,
    stage, value, expected_close_date, lead_source, type, description, next_step } = req.body;

  if (!opportunity_name || !client_id) {
    return res.status(400).json({ error: 'Opportunity name and client are required.' });
  }

  // Auto-set probability based on stage
  const selectedStage = stage || 'prospecting';
  const probability = STAGE_PROBABILITY[selectedStage] !== undefined
    ? STAGE_PROBABILITY[selectedStage] : 10;

  const result = db.prepare(`
    INSERT INTO opportunities (opportunity_name, client_id, contact_id, assigned_user_id,
      stage, probability, value, expected_close_date, lead_source, type, description, next_step)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(opportunity_name, client_id, contact_id || null, assigned_user_id || null,
    selectedStage, probability, value || 0, expected_close_date || null,
    lead_source || null, type || 'new_business', description || null, next_step || null);

  const opp = db.prepare(`
    SELECT o.*, c.client_name, c.company_name, u.name as assigned_user_name
    FROM opportunities o
    LEFT JOIN clients c ON o.client_id = c.id
    LEFT JOIN users u ON o.assigned_user_id = u.id
    WHERE o.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(opp);
});

// ============================================================
// PUT /api/opportunities/:id — Update opportunity (admin only)
// When stage changes, probability auto-updates
// ============================================================
router.put('/:id', adminOnly, (req, res) => {
  const existing = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Opportunity not found.' });
  }

  const { opportunity_name, client_id, contact_id, assigned_user_id,
    stage, probability, value, expected_close_date, lead_source, type, description, next_step } = req.body;

  // If stage changed, auto-update probability (unless manually overridden)
  const newStage = stage || existing.stage;
  let newProbability = probability;
  if (stage && stage !== existing.stage && probability === undefined) {
    newProbability = STAGE_PROBABILITY[stage];
  }
  if (newProbability === undefined) {
    newProbability = existing.probability;
  }

  db.prepare(`
    UPDATE opportunities SET opportunity_name=?, client_id=?, contact_id=?, assigned_user_id=?,
      stage=?, probability=?, value=?, expected_close_date=?, lead_source=?, type=?, 
      description=?, next_step=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    opportunity_name || existing.opportunity_name,
    client_id || existing.client_id,
    contact_id !== undefined ? contact_id : existing.contact_id,
    assigned_user_id !== undefined ? assigned_user_id : existing.assigned_user_id,
    newStage, newProbability,
    value !== undefined ? value : existing.value,
    expected_close_date || existing.expected_close_date,
    lead_source || existing.lead_source,
    type || existing.type,
    description !== undefined ? description : existing.description,
    next_step !== undefined ? next_step : existing.next_step,
    req.params.id
  );

  const opp = db.prepare(`
    SELECT o.*, c.client_name, c.company_name, u.name as assigned_user_name
    FROM opportunities o
    LEFT JOIN clients c ON o.client_id = c.id
    LEFT JOIN users u ON o.assigned_user_id = u.id
    WHERE o.id = ?
  `).get(req.params.id);

  res.json(opp);
});

// ============================================================
// DELETE /api/opportunities/:id — Delete opportunity (admin only)
// ============================================================
router.delete('/:id', adminOnly, (req, res) => {
  const opp = db.prepare('SELECT id FROM opportunities WHERE id = ?').get(req.params.id);
  if (!opp) {
    return res.status(404).json({ error: 'Opportunity not found.' });
  }

  db.prepare('DELETE FROM opportunities WHERE id = ?').run(req.params.id);
  res.json({ message: 'Opportunity deleted successfully.' });
});

module.exports = router;
