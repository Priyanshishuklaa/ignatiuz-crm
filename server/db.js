// ============================================================
// DATABASE SETUP — SQLite with better-sqlite3
// This file creates all tables and seeds realistic demo data.
// The database is stored as a file (crm.db) — no server needed!
// ============================================================

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Create/open the database file
const dbPath = process.env.DB_PATH || path.join(__dirname, 'crm.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Enable foreign keys (SQLite disables them by default!)
db.pragma('foreign_keys = ON');

// ============================================================
// SCHEMA — 6 tables that model a real CRM
// ============================================================

db.exec(`
  -- USERS: People who log into the system
  -- Role determines what they can see and do
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,           -- bcrypt hashed, never stored plain!
    role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('admin', 'client', 'employee')),
    phone TEXT,
    department TEXT,
    designation TEXT,
    is_active INTEGER DEFAULT 1,     -- SQLite uses 0/1 for booleans
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- CLIENTS: The companies/organizations the business works with
  -- Each client can be assigned to a specific user (for RBAC filtering)
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    company_name TEXT,
    industry TEXT,
    website TEXT,
    annual_revenue REAL DEFAULT 0,
    billing_street TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_zip TEXT,
    billing_country TEXT,
    shipping_street TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_zip TEXT,
    shipping_country TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    source TEXT DEFAULT 'direct',
    description TEXT,
    assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- CONTACTS: Individual people at each client company
  -- e.g., the CEO, CTO, VP of Sales at "Acme Corp"
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    designation TEXT,
    department TEXT,
    is_primary INTEGER DEFAULT 0,    -- 1 = main point of contact
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- OPPORTUNITIES: Sales deals being pursued
  -- Moves through stages: Prospecting → Qualification → ... → Closed Won/Lost
  CREATE TABLE IF NOT EXISTS opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_name TEXT NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    stage TEXT NOT NULL DEFAULT 'prospecting' 
      CHECK(stage IN ('prospecting','qualification','needs_analysis','proposal','negotiation','closed_won','closed_lost')),
    probability INTEGER DEFAULT 10,  -- Auto-set based on stage
    value REAL DEFAULT 0,            -- Deal amount in dollars
    expected_close_date TEXT,
    lead_source TEXT,
    type TEXT DEFAULT 'new_business' CHECK(type IN ('new_business', 'existing_business', 'renewal')),
    description TEXT,
    next_step TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- INVOICES: Bills sent to clients
  -- Auto-generated invoice numbers like INV-202603-0001
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
    subject TEXT,
    invoice_date TEXT DEFAULT (date('now')),
    due_date TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','overdue','cancelled','partially_paid')),
    subtotal REAL DEFAULT 0,
    discount_type TEXT DEFAULT 'flat' CHECK(discount_type IN ('flat', 'percent')),
    discount_value REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    shipping_charges REAL DEFAULT 0,
    adjustment REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    billing_street TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_zip TEXT,
    billing_country TEXT,
    notes TEXT,
    terms TEXT DEFAULT 'Payment is due within the specified payment terms. Late payments may incur additional charges.',
    payment_terms TEXT DEFAULT 'Net 30',
    currency TEXT DEFAULT 'USD',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- INVOICE_ITEMS: Individual line items on each invoice
  -- e.g., "10 hours of consulting at $150/hr"
  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_order INTEGER DEFAULT 1,
    description TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'Units',
    rate REAL DEFAULT 0,
    discount_percent REAL DEFAULT 0,
    tax_percent REAL DEFAULT 0,
    amount REAL DEFAULT 0            -- Auto-calculated: (qty × rate) × (1 - disc%)
  );
`);

// ============================================================
// SEED DATA — Only runs if the users table is empty
// Creates realistic demo data so the app works immediately
// ============================================================

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

if (userCount === 0) {
  console.log('🌱 Seeding database with demo data...');

  // --- USERS ---
  // bcrypt.hashSync creates a one-way hash of the password
  // The "10" is the salt rounds (higher = more secure but slower)
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password, role, phone, department, designation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('Admin User', 'admin@crm.com', bcrypt.hashSync('admin123', 10), 'admin', '+1-555-100-0001', 'Management', 'System Administrator');
  insertUser.run('Sarah Johnson', 'sarah@crm.com', bcrypt.hashSync('client123', 10), 'client', '+1-555-200-0002', 'Sales', 'Account Manager');
  insertUser.run('Mike Chen', 'mike@crm.com', bcrypt.hashSync('employee123', 10), 'employee', '+1-555-300-0003', 'Sales', 'Sales Representative');

  // --- CLIENTS ---
  const insertClient = db.prepare(`
    INSERT INTO clients (client_name, email, phone, mobile, company_name, industry, website, annual_revenue,
      billing_street, billing_city, billing_state, billing_zip, billing_country,
      status, source, description, assigned_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertClient.run('Rajesh Kumar', 'rajesh@techvision.com', '+91-9876543210', '+91-9876543211',
    'TechVision Solutions', 'Technology', 'https://techvision.com', 5000000,
    '42 MG Road', 'Bangalore', 'Karnataka', '560001', 'India',
    'active', 'website', 'Leading technology solutions provider in South India', 2);

  insertClient.run('Priya Sharma', 'priya@cloudnine.io', '+91-8765432109', '+91-8765432100',
    'CloudNine Systems', 'IT Services', 'https://cloudnine.io', 3500000,
    '15 Cyber City', 'Gurugram', 'Haryana', '122002', 'India',
    'active', 'referral', 'Cloud infrastructure and DevOps consulting firm', 2);

  insertClient.run('David Wilson', 'david@strategicminds.com', '+1-555-300-0001', '+1-555-300-0002',
    'Strategic Minds Inc', 'Consulting', 'https://strategicminds.com', 8000000,
    '200 Park Avenue', 'New York', 'NY', '10166', 'USA',
    'active', 'trade_show', 'Global management consulting firm', 1);

  insertClient.run('Anita Desai', 'anita@healthfirst.in', '+91-7654321098', '+91-7654321099',
    'HealthFirst Innovations', 'Healthcare', 'https://healthfirst.in', 2000000,
    '8 Residency Road', 'Mumbai', 'Maharashtra', '400001', 'India',
    'active', 'cold_call', 'Healthcare technology and telemedicine platform', 1);

  insertClient.run('James Miller', 'james@precisionmfg.com', '+1-555-500-0001', '+1-555-500-0002',
    'Precision Manufacturing Co', 'Manufacturing', 'https://precisionmfg.com', 12000000,
    '500 Industrial Blvd', 'Detroit', 'MI', '48201', 'USA',
    'inactive', 'direct', 'Precision parts manufacturing for aerospace industry', 1);

  // --- CONTACTS ---
  const insertContact = db.prepare(`
    INSERT INTO contacts (client_id, first_name, last_name, email, phone, mobile, designation, department, is_primary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // TechVision contacts
  insertContact.run(1, 'Rajesh', 'Kumar', 'rajesh@techvision.com', '+91-9876543210', '+91-9876543211', 'CEO', 'Executive', 1);
  insertContact.run(1, 'Sneha', 'Patel', 'sneha@techvision.com', '+91-9876543220', null, 'CTO', 'Technology', 0);

  // CloudNine contacts
  insertContact.run(2, 'Priya', 'Sharma', 'priya@cloudnine.io', '+91-8765432109', null, 'Founder & CEO', 'Executive', 1);

  // Strategic Minds contacts
  insertContact.run(3, 'David', 'Wilson', 'david@strategicminds.com', '+1-555-300-0001', null, 'Managing Partner', 'Leadership', 1);
  insertContact.run(3, 'Emily', 'Chen', 'emily@strategicminds.com', '+1-555-300-0003', null, 'VP Sales', 'Sales', 0);

  // HealthFirst contacts
  insertContact.run(4, 'Anita', 'Desai', 'anita@healthfirst.in', '+91-7654321098', null, 'Director', 'Operations', 1);

  // --- OPPORTUNITIES ---
  const insertOpp = db.prepare(`
    INSERT INTO opportunities (opportunity_name, client_id, contact_id, assigned_user_id, stage, probability, value, expected_close_date, lead_source, type, description, next_step)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Each stage is represented for demo purposes
  insertOpp.run('Cloud Migration Project', 1, 1, 1, 'prospecting', 10, 150000, '2026-06-30', 'website', 'new_business', 'Full cloud migration for TechVision', 'Schedule discovery call');
  insertOpp.run('DevOps Pipeline Setup', 2, 3, 2, 'qualification', 20, 85000, '2026-05-15', 'referral', 'new_business', 'CI/CD pipeline implementation', 'Prepare technical questionnaire');
  insertOpp.run('Annual Consulting Retainer', 3, 4, 1, 'needs_analysis', 40, 250000, '2026-04-30', 'trade_show', 'renewal', 'Annual strategic consulting engagement', 'Deep-dive requirements workshop');
  insertOpp.run('ERP System Upgrade', 1, 2, 1, 'proposal', 60, 320000, '2026-05-20', 'direct', 'existing_business', 'Upgrade legacy ERP to cloud-based', 'Send technical proposal');
  insertOpp.run('Telemedicine Platform', 4, 6, 1, 'negotiation', 80, 450000, '2026-04-15', 'cold_call', 'new_business', 'Build telemedicine consultation platform', 'Final price negotiation');
  insertOpp.run('Data Analytics Suite', 2, 3, 2, 'closed_won', 100, 175000, '2026-03-01', 'referral', 'new_business', 'Business intelligence dashboard implementation', 'Contract signed');
  insertOpp.run('Legacy System Migration', 5, null, 1, 'closed_lost', 0, 95000, '2026-02-28', 'direct', 'existing_business', 'Migration from legacy systems', 'Lost to competitor');

  // --- INVOICES ---
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (invoice_number, client_id, contact_id, opportunity_id, subject, invoice_date, due_date, status,
      subtotal, discount_type, discount_value, discount_amount, tax_rate, tax_amount,
      shipping_charges, adjustment, total_amount,
      billing_street, billing_city, billing_state, billing_zip, billing_country, notes, payment_terms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO invoice_items (invoice_id, item_order, description, quantity, unit, rate, discount_percent, tax_percent, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Invoice 1: Paid — Data Analytics Suite (CloudNine)
  // subtotal=175000, discount=5% → 8750, taxable=166250, tax=18% → 29925, total=196175
  insertInvoice.run('INV-202603-0001', 2, 3, 6, 'Data Analytics Suite - Final Invoice', '2026-02-15', '2026-03-15', 'paid',
    175000, 'percent', 5, 8750, 18, 29925, 0, 0, 196175,
    '15 Cyber City', 'Gurugram', 'Haryana', '122002', 'India', 'Thank you for your business!', 'Net 30');

  insertItem.run(1, 1, 'Business Intelligence Dashboard Development', 400, 'Hours', 250, 0, 0, 100000);
  insertItem.run(1, 2, 'Data Pipeline Architecture & Setup', 200, 'Hours', 200, 0, 0, 40000);
  insertItem.run(1, 3, 'User Training & Documentation', 50, 'Hours', 300, 0, 0, 15000);
  insertItem.run(1, 4, 'Annual BI Platform License', 1, 'Licenses', 20000, 0, 0, 20000);

  // Invoice 2: Sent — ERP Upgrade Phase 1 (TechVision)
  // subtotal=128000, discount=flat 3000, taxable=125000, tax=18% → 22500, shipping=500, total=148000
  insertInvoice.run('INV-202603-0002', 1, 2, 4, 'ERP System Upgrade - Phase 1', '2026-03-01', '2026-04-01', 'sent',
    128000, 'flat', 3000, 3000, 18, 22500, 500, 0, 148000,
    '42 MG Road', 'Bangalore', 'Karnataka', '560001', 'India', 'Phase 1 of 3. Includes architecture and core module development.', 'Net 30');

  insertItem.run(2, 1, 'ERP Core Module Development', 300, 'Hours', 280, 0, 0, 84000);
  insertItem.run(2, 2, 'Database Architecture & Migration', 120, 'Hours', 250, 0, 0, 30000);
  insertItem.run(2, 3, 'Project Management', 1, 'Project', 14000, 0, 0, 14000);

  // Invoice 3: Overdue — Consulting Retainer Q1 (Strategic Minds)
  // subtotal=62500, no discount, tax=10% → 6250, total=68750
  insertInvoice.run('INV-202603-0003', 3, 4, 3, 'Strategic Consulting - Q1 2026', '2026-01-15', '2026-02-15', 'overdue',
    62500, 'flat', 0, 0, 10, 6250, 0, 0, 68750,
    '200 Park Avenue', 'New York', 'NY', '10166', 'USA', 'Quarterly consulting retainer.', 'Net 30');

  insertItem.run(3, 1, 'Strategic Advisory Services', 100, 'Hours', 350, 0, 0, 35000);
  insertItem.run(3, 2, 'Market Research & Analysis', 50, 'Hours', 300, 0, 0, 15000);
  insertItem.run(3, 3, 'Executive Workshop Facilitation', 5, 'Days', 2500, 0, 0, 12500);

  // Invoice 4: Draft — Telemedicine Platform (HealthFirst)
  // subtotal=225000, discount=10% → 22500, taxable=202500, tax=18% → 36450, adjustment=-450, total=238500
  insertInvoice.run('INV-202603-0004', 4, 6, 5, 'Telemedicine Platform - Milestone 1', '2026-03-20', '2026-04-20', 'draft',
    225000, 'percent', 10, 22500, 18, 36450, 0, -450, 238500,
    '8 Residency Road', 'Mumbai', 'Maharashtra', '400001', 'India', 'Milestone 1: Platform architecture and patient portal.', 'Net 30');

  insertItem.run(4, 1, 'Platform Architecture Design', 150, 'Hours', 300, 0, 0, 45000);
  insertItem.run(4, 2, 'Patient Portal Development', 500, 'Hours', 250, 0, 0, 125000);
  insertItem.run(4, 3, 'Video Consultation Module', 200, 'Hours', 275, 0, 0, 55000);

  console.log('✅ Database seeded successfully!');
}

module.exports = db;
