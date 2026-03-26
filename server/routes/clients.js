// ============================================================
// CLIENT ROUTES — Client and Contact management
// Includes nested contact operations under each client.
// RBAC: Non-admin users only see clients assigned to them.
// ============================================================

const express = require('express');
const db = require('../db');
const { authenticateToken, adminOnly } = require('../middleware');

const router = express.Router();
router.use(authenticateToken);

// ============================================================
// GET /api/clients — List all clients
// Admin: sees all clients. Client/Employee: only assigned ones.
// ============================================================
router.get('/', (req, res) => {
  let clients;

  if (req.user.role === 'admin') {
    // Admin sees everything with aggregated counts
    clients = db.prepare(`
      SELECT c.*,
        u.name as assigned_user_name,
        (SELECT COUNT(*) FROM contacts WHERE client_id = c.id) as contact_count,
        (SELECT COUNT(*) FROM opportunities WHERE client_id = c.id) as opportunity_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE client_id = c.id AND status = 'paid') as total_revenue
      FROM clients c
      LEFT JOIN users u ON c.assigned_user_id = u.id
      ORDER BY c.created_at DESC
    `).all();
  } else {
    // Non-admin: only see clients assigned to them
    clients = db.prepare(`
      SELECT c.*,
        u.name as assigned_user_name,
        (SELECT COUNT(*) FROM contacts WHERE client_id = c.id) as contact_count,
        (SELECT COUNT(*) FROM opportunities WHERE client_id = c.id) as opportunity_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE client_id = c.id AND status = 'paid') as total_revenue
      FROM clients c
      LEFT JOIN users u ON c.assigned_user_id = u.id
      WHERE c.assigned_user_id = ?
      ORDER BY c.created_at DESC
    `).all(req.user.id);
  }

  res.json(clients);
});

// ============================================================
// GET /api/clients/:id — Get client detail with related data
// Returns contacts, opportunities, and invoices for this client
// ============================================================
router.get('/:id', (req, res) => {
  const client = db.prepare(`
    SELECT c.*, u.name as assigned_user_name
    FROM clients c
    LEFT JOIN users u ON c.assigned_user_id = u.id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!client) {
    return res.status(404).json({ error: 'Client not found.' });
  }

  // RBAC check: non-admin can only view their assigned clients
  if (req.user.role !== 'admin' && client.assigned_user_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  // Fetch all related data for the detail view
  const contacts = db.prepare('SELECT * FROM contacts WHERE client_id = ? ORDER BY is_primary DESC, first_name').all(client.id);
  const opportunities = db.prepare(`
    SELECT o.*, u.name as assigned_user_name 
    FROM opportunities o 
    LEFT JOIN users u ON o.assigned_user_id = u.id
    WHERE o.client_id = ? ORDER BY o.created_at DESC
  `).all(client.id);
  const invoices = db.prepare('SELECT * FROM invoices WHERE client_id = ? ORDER BY invoice_date DESC').all(client.id);

  res.json({ ...client, contacts, opportunities, invoices });
});

// ============================================================
// POST /api/clients — Create new client (admin only)
// ============================================================
router.post('/', adminOnly, (req, res) => {
  const { client_name, email, phone, mobile, company_name, industry, website, annual_revenue,
    billing_street, billing_city, billing_state, billing_zip, billing_country,
    shipping_street, shipping_city, shipping_state, shipping_zip, shipping_country,
    status, source, description, assigned_user_id } = req.body;

  if (!client_name) {
    return res.status(400).json({ error: 'Client name is required.' });
  }

  const result = db.prepare(`
    INSERT INTO clients (client_name, email, phone, mobile, company_name, industry, website, annual_revenue,
      billing_street, billing_city, billing_state, billing_zip, billing_country,
      shipping_street, shipping_city, shipping_state, shipping_zip, shipping_country,
      status, source, description, assigned_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(client_name, email || null, phone || null, mobile || null, company_name || null,
    industry || null, website || null, annual_revenue || 0,
    billing_street || null, billing_city || null, billing_state || null, billing_zip || null, billing_country || null,
    shipping_street || null, shipping_city || null, shipping_state || null, shipping_zip || null, shipping_country || null,
    status || 'active', source || 'direct', description || null, assigned_user_id || null);

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(client);
});

// ============================================================
// PUT /api/clients/:id — Update client (admin only)
// ============================================================
router.put('/:id', adminOnly, (req, res) => {
  const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Client not found.' });
  }

  const { client_name, email, phone, mobile, company_name, industry, website, annual_revenue,
    billing_street, billing_city, billing_state, billing_zip, billing_country,
    status, source, description, assigned_user_id } = req.body;

  db.prepare(`
    UPDATE clients SET client_name=?, email=?, phone=?, mobile=?, company_name=?, industry=?, website=?, annual_revenue=?,
      billing_street=?, billing_city=?, billing_state=?, billing_zip=?, billing_country=?,
      status=?, source=?, description=?, assigned_user_id=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    client_name || existing.client_name, email !== undefined ? email : existing.email,
    phone !== undefined ? phone : existing.phone, mobile !== undefined ? mobile : existing.mobile,
    company_name !== undefined ? company_name : existing.company_name,
    industry !== undefined ? industry : existing.industry,
    website !== undefined ? website : existing.website,
    annual_revenue !== undefined ? annual_revenue : existing.annual_revenue,
    billing_street !== undefined ? billing_street : existing.billing_street,
    billing_city !== undefined ? billing_city : existing.billing_city,
    billing_state !== undefined ? billing_state : existing.billing_state,
    billing_zip !== undefined ? billing_zip : existing.billing_zip,
    billing_country !== undefined ? billing_country : existing.billing_country,
    status || existing.status, source || existing.source,
    description !== undefined ? description : existing.description,
    assigned_user_id !== undefined ? assigned_user_id : existing.assigned_user_id,
    req.params.id
  );

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  res.json(client);
});

// ============================================================
// DELETE /api/clients/:id — Delete client (admin only)
// CASCADE will also delete contacts, opportunities, invoices
// ============================================================
router.delete('/:id', adminOnly, (req, res) => {
  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!client) {
    return res.status(404).json({ error: 'Client not found.' });
  }

  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ message: 'Client deleted successfully.' });
});

// ============================================================
// CONTACT SUB-ROUTES — Nested under clients
// POST   /api/clients/:id/contacts     — Add contact
// DELETE /api/clients/:id/contacts/:cid — Remove contact
// ============================================================

// Add a contact to a client
router.post('/:id/contacts', adminOnly, (req, res) => {
  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!client) {
    return res.status(404).json({ error: 'Client not found.' });
  }

  const { first_name, last_name, email, phone, mobile, designation, department, is_primary } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'First name and last name are required.' });
  }

  // If this contact is primary, un-primary the existing ones
  if (is_primary) {
    db.prepare('UPDATE contacts SET is_primary = 0 WHERE client_id = ?').run(req.params.id);
  }

  const result = db.prepare(`
    INSERT INTO contacts (client_id, first_name, last_name, email, phone, mobile, designation, department, is_primary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, first_name, last_name, email || null, phone || null, mobile || null,
    designation || null, department || null, is_primary ? 1 : 0);

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(contact);
});

// Delete a contact
router.delete('/:id/contacts/:contactId', adminOnly, (req, res) => {
  const contact = db.prepare('SELECT id FROM contacts WHERE id = ? AND client_id = ?').get(req.params.contactId, req.params.id);
  if (!contact) {
    return res.status(404).json({ error: 'Contact not found.' });
  }

  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.contactId);
  res.json({ message: 'Contact deleted successfully.' });
});

module.exports = router;
