// ============================================================
// INVOICE ROUTES — The most complex module
// Handles line items, auto-calculations, and unique numbering.
// Formula: Total = Subtotal - Discount + Tax + Shipping + Adjustment
// ============================================================

const express = require('express');
const db = require('../db');
const { authenticateToken, adminOnly } = require('../middleware');

const router = express.Router();
router.use(authenticateToken);

// ============================================================
// Helper: Generate unique invoice number
// Format: INV-YYYYMM-NNNN (e.g., INV-202603-0005)
// ============================================================
function generateInvoiceNumber() {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Find the highest existing number with this prefix
  const latest = db.prepare(`
    SELECT invoice_number FROM invoices 
    WHERE invoice_number LIKE ? 
    ORDER BY invoice_number DESC LIMIT 1
  `).get(`${prefix}%`);

  let nextNum = 1;
  if (latest) {
    // Extract the number part and increment
    const parts = latest.invoice_number.split('-');
    nextNum = parseInt(parts[2]) + 1;
  }

  return `${prefix}-${String(nextNum).padStart(4, '0')}`;
}

// ============================================================
// Helper: Calculate invoice totals from line items
// This is the core financial calculation logic
// ============================================================
function calculateTotals(items, discountType, discountValue, taxRate, shippingCharges, adjustment) {
  // Step 1: Calculate subtotal from all line items
  const subtotal = items.reduce((sum, item) => {
    const lineAmount = (item.quantity || 0) * (item.rate || 0) * (1 - (item.discount_percent || 0) / 100);
    return sum + lineAmount;
  }, 0);

  // Step 2: Calculate discount
  let discountAmount = 0;
  if (discountType === 'percent') {
    discountAmount = subtotal * (discountValue || 0) / 100;
  } else {
    discountAmount = discountValue || 0;
  }

  // Step 3: Calculate tax on (subtotal - discount)
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (taxRate || 0) / 100;

  // Step 4: Final total
  const total = taxableAmount + taxAmount + (shippingCharges || 0) + (adjustment || 0);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(total * 100) / 100
  };
}

// ============================================================
// GET /api/invoices — List all invoices
// ============================================================
router.get('/', (req, res) => {
  let invoices;

  if (req.user.role === 'admin') {
    invoices = db.prepare(`
      SELECT i.*, 
        c.client_name, c.company_name,
        ct.first_name || ' ' || ct.last_name as contact_name,
        (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN contacts ct ON i.contact_id = ct.id
      ORDER BY i.created_at DESC
    `).all();
  } else {
    invoices = db.prepare(`
      SELECT i.*, 
        c.client_name, c.company_name,
        ct.first_name || ' ' || ct.last_name as contact_name,
        (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN contacts ct ON i.contact_id = ct.id
      WHERE c.assigned_user_id = ?
      ORDER BY i.created_at DESC
    `).all(req.user.id);
  }

  res.json(invoices);
});

// ============================================================
// GET /api/invoices/:id — Get invoice with line items
// ============================================================
router.get('/:id', (req, res) => {
  const invoice = db.prepare(`
    SELECT i.*, 
      c.client_name, c.company_name, c.email as client_email,
      ct.first_name || ' ' || ct.last_name as contact_name,
      o.opportunity_name
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN contacts ct ON i.contact_id = ct.id
    LEFT JOIN opportunities o ON i.opportunity_id = o.id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }

  // Get all line items for this invoice
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY item_order').all(invoice.id);

  res.json({ ...invoice, items });
});

// ============================================================
// POST /api/invoices — Create invoice with line items (admin only)
// Auto-generates invoice number and calculates totals
// ============================================================
router.post('/', adminOnly, (req, res) => {
  const { client_id, contact_id, opportunity_id, subject,
    invoice_date, due_date, status,
    discount_type, discount_value, tax_rate,
    shipping_charges, adjustment,
    billing_street, billing_city, billing_state, billing_zip, billing_country,
    notes, terms, payment_terms, currency, items } = req.body;

  if (!client_id) {
    return res.status(400).json({ error: 'Client is required.' });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'At least one line item is required.' });
  }

  // Calculate totals from line items
  const totals = calculateTotals(items, discount_type, discount_value, tax_rate, shipping_charges, adjustment);

  // Generate unique invoice number
  const invoiceNumber = generateInvoiceNumber();

  // Insert invoice using a transaction (all-or-nothing)
  const insertInvoice = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO invoices (invoice_number, client_id, contact_id, opportunity_id, subject,
        invoice_date, due_date, status,
        subtotal, discount_type, discount_value, discount_amount, tax_rate, tax_amount,
        shipping_charges, adjustment, total_amount,
        billing_street, billing_city, billing_state, billing_zip, billing_country,
        notes, terms, payment_terms, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoiceNumber, client_id, contact_id || null, opportunity_id || null, subject || null,
      invoice_date || new Date().toISOString().split('T')[0],
      due_date || null, status || 'draft',
      totals.subtotal, discount_type || 'flat', discount_value || 0, totals.discountAmount,
      tax_rate || 0, totals.taxAmount,
      shipping_charges || 0, adjustment || 0, totals.totalAmount,
      billing_street || null, billing_city || null, billing_state || null,
      billing_zip || null, billing_country || null,
      notes || null, terms || null, payment_terms || 'Net 30', currency || 'USD');

    const invoiceId = result.lastInsertRowid;

    // Insert line items
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, item_order, description, quantity, unit, rate, discount_percent, tax_percent, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    items.forEach((item, index) => {
      const amount = (item.quantity || 0) * (item.rate || 0) * (1 - (item.discount_percent || 0) / 100);
      insertItem.run(invoiceId, index + 1, item.description, item.quantity || 1,
        item.unit || 'Units', item.rate || 0, item.discount_percent || 0,
        item.tax_percent || 0, Math.round(amount * 100) / 100);
    });

    return invoiceId;
  });

  const invoiceId = insertInvoice();

  // Fetch the complete invoice with items
  const invoice = db.prepare(`
    SELECT i.*, c.client_name, c.company_name
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.id = ?
  `).get(invoiceId);

  const invoiceItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY item_order').all(invoiceId);

  res.status(201).json({ ...invoice, items: invoiceItems });
});

// ============================================================
// PUT /api/invoices/:id — Update invoice (admin only)
// Recalculates totals if items are provided
// ============================================================
router.put('/:id', adminOnly, (req, res) => {
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }

  const { client_id, contact_id, opportunity_id, subject,
    invoice_date, due_date, status,
    discount_type, discount_value, tax_rate,
    shipping_charges, adjustment,
    billing_street, billing_city, billing_state, billing_zip, billing_country,
    notes, terms, payment_terms, items } = req.body;

  const updateInvoice = db.transaction(() => {
    let totals = {
      subtotal: existing.subtotal,
      discountAmount: existing.discount_amount,
      taxAmount: existing.tax_amount,
      totalAmount: existing.total_amount
    };

    // Recalculate if items are provided
    if (items && items.length > 0) {
      totals = calculateTotals(items,
        discount_type || existing.discount_type,
        discount_value !== undefined ? discount_value : existing.discount_value,
        tax_rate !== undefined ? tax_rate : existing.tax_rate,
        shipping_charges !== undefined ? shipping_charges : existing.shipping_charges,
        adjustment !== undefined ? adjustment : existing.adjustment
      );

      // Delete old items and insert new ones
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);

      const insertItem = db.prepare(`
        INSERT INTO invoice_items (invoice_id, item_order, description, quantity, unit, rate, discount_percent, tax_percent, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      items.forEach((item, index) => {
        const amount = (item.quantity || 0) * (item.rate || 0) * (1 - (item.discount_percent || 0) / 100);
        insertItem.run(req.params.id, index + 1, item.description, item.quantity || 1,
          item.unit || 'Units', item.rate || 0, item.discount_percent || 0,
          item.tax_percent || 0, Math.round(amount * 100) / 100);
      });
    }

    db.prepare(`
      UPDATE invoices SET client_id=?, contact_id=?, opportunity_id=?, subject=?,
        invoice_date=?, due_date=?, status=?,
        subtotal=?, discount_type=?, discount_value=?, discount_amount=?, tax_rate=?, tax_amount=?,
        shipping_charges=?, adjustment=?, total_amount=?,
        billing_street=?, billing_city=?, billing_state=?, billing_zip=?, billing_country=?,
        notes=?, terms=?, payment_terms=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      client_id || existing.client_id, contact_id !== undefined ? contact_id : existing.contact_id,
      opportunity_id !== undefined ? opportunity_id : existing.opportunity_id,
      subject !== undefined ? subject : existing.subject,
      invoice_date || existing.invoice_date, due_date || existing.due_date,
      status || existing.status,
      totals.subtotal, discount_type || existing.discount_type,
      discount_value !== undefined ? discount_value : existing.discount_value,
      totals.discountAmount, tax_rate !== undefined ? tax_rate : existing.tax_rate,
      totals.taxAmount, shipping_charges !== undefined ? shipping_charges : existing.shipping_charges,
      adjustment !== undefined ? adjustment : existing.adjustment, totals.totalAmount,
      billing_street !== undefined ? billing_street : existing.billing_street,
      billing_city !== undefined ? billing_city : existing.billing_city,
      billing_state !== undefined ? billing_state : existing.billing_state,
      billing_zip !== undefined ? billing_zip : existing.billing_zip,
      billing_country !== undefined ? billing_country : existing.billing_country,
      notes !== undefined ? notes : existing.notes,
      terms !== undefined ? terms : existing.terms,
      payment_terms || existing.payment_terms,
      req.params.id
    );
  });

  updateInvoice();

  const invoice = db.prepare(`
    SELECT i.*, c.client_name, c.company_name
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.id = ?
  `).get(req.params.id);

  const invoiceItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY item_order').all(req.params.id);

  res.json({ ...invoice, items: invoiceItems });
});

// ============================================================
// DELETE /api/invoices/:id — Delete invoice (admin only)
// ============================================================
router.delete('/:id', adminOnly, (req, res) => {
  const invoice = db.prepare('SELECT id FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }

  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.json({ message: 'Invoice deleted successfully.' });
});

module.exports = router;
