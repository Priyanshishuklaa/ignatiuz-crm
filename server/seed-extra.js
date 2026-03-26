// ============================================================
// SEED EXTRA DATA — Adds more employees + clients to the DB
// Run once: node seed-extra.js
// ============================================================

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'crm.db'));
db.pragma('foreign_keys = ON');

const hashedPassword = bcrypt.hashSync('password123', 10);

// ============================================================
// EXTRA EMPLOYEES
// ============================================================
const insertUser = db.prepare(`
  INSERT INTO users (name, email, password, role, phone, department, designation)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const employees = [
  ['Aisha Khan',       'aisha@crm.com',    hashedPassword, 'employee', '+91-9988776655', 'Sales',         'Senior Account Executive'],
  ['Robert Martinez',  'robert@crm.com',   hashedPassword, 'employee', '+1-555-400-0010', 'Engineering',  'Solutions Architect'],
  ['Neha Gupta',       'neha@crm.com',     hashedPassword, 'employee', '+91-8877665544', 'Marketing',     'Marketing Manager'],
  ['Tom Anderson',     'tom@crm.com',      hashedPassword, 'employee', '+1-555-400-0020', 'Support',      'Customer Success Lead'],
  ['Fatima Ali',       'fatima@crm.com',   hashedPassword, 'employee', '+92-3331234567', 'Sales',         'Business Development Rep'],
  ['Carlos Rivera',    'carlos@crm.com',   hashedPassword, 'employee', '+1-555-400-0030', 'Engineering',  'Technical Consultant'],
  ['Meera Reddy',      'meera@crm.com',    hashedPassword, 'employee', '+91-9123456789', 'Operations',    'Operations Manager'],
  ['Daniel Kim',       'daniel@crm.com',   hashedPassword, 'employee', '+82-1098765432', 'Sales',         'Regional Sales Manager'],
];

let employeeIds = [];
console.log('👥 Adding employees...');
for (const emp of employees) {
  // Skip if email already exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(emp[1]);
  if (existing) {
    console.log(`   ⏭  ${emp[0]} already exists, skipping.`);
    employeeIds.push(existing.id);
    continue;
  }
  const result = insertUser.run(...emp);
  employeeIds.push(result.lastInsertRowid);
  console.log(`   ✅ ${emp[0]} (${emp[3]}) — ${emp[1]}`);
}

// ============================================================
// EXTRA CLIENTS + CONTACTS
// ============================================================
const insertClient = db.prepare(`
  INSERT INTO clients (client_name, email, phone, mobile, company_name, industry, website, annual_revenue,
    billing_street, billing_city, billing_state, billing_zip, billing_country,
    status, source, description, assigned_user_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertContact = db.prepare(`
  INSERT INTO contacts (client_id, first_name, last_name, email, phone, mobile, designation, department, is_primary)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

console.log('\n🏢 Adding clients...');

const clients = [
  {
    data: ['Vikram Mehta', 'vikram@innovatech.in', '+91-9012345678', '+91-9012345679',
      'InnovaTech Pvt Ltd', 'Software', 'https://innovatech.in', 7500000,
      '23 Electronic City', 'Bangalore', 'Karnataka', '560100', 'India',
      'active', 'website', 'End-to-end software product development company', null],
    contacts: [
      [null, 'Vikram', 'Mehta', 'vikram@innovatech.in', '+91-9012345678', null, 'CEO & Founder', 'Executive', 1],
      [null, 'Ritu', 'Joshi', 'ritu@innovatech.in', '+91-9012345680', null, 'VP Engineering', 'Technology', 0],
    ]
  },
  {
    data: ['Amanda Foster', 'amanda@globaledge.com', '+1-555-600-0001', '+1-555-600-0002',
      'GlobalEdge Consulting', 'Consulting', 'https://globaledge.com', 15000000,
      '350 Fifth Avenue', 'New York', 'NY', '10118', 'USA',
      'active', 'trade_show', 'Fortune 500 management consulting firm', null],
    contacts: [
      [null, 'Amanda', 'Foster', 'amanda@globaledge.com', '+1-555-600-0001', null, 'Managing Director', 'Leadership', 1],
      [null, 'Brian', 'Lee', 'brian@globaledge.com', '+1-555-600-0003', null, 'Head of Procurement', 'Procurement', 0],
      [null, 'Catherine', 'Novak', 'catherine@globaledge.com', '+1-555-600-0004', null, 'CFO', 'Finance', 0],
    ]
  },
  {
    data: ['Suresh Nair', 'suresh@marinelogix.com', '+91-4842345678', '+91-9876501234',
      'MarineLogix Solutions', 'Logistics', 'https://marinelogix.com', 4200000,
      '12 Willingdon Island', 'Kochi', 'Kerala', '682003', 'India',
      'active', 'referral', 'Maritime logistics and supply chain management', null],
    contacts: [
      [null, 'Suresh', 'Nair', 'suresh@marinelogix.com', '+91-4842345678', null, 'Director', 'Operations', 1],
    ]
  },
  {
    data: ['Lisa Thompson', 'lisa@brighthorizons.edu', '+1-555-700-0001', '+1-555-700-0002',
      'Bright Horizons EdTech', 'Education', 'https://brighthorizons.edu', 3200000,
      '100 University Ave', 'Palo Alto', 'CA', '94301', 'USA',
      'active', 'cold_call', 'K-12 educational technology platform provider', null],
    contacts: [
      [null, 'Lisa', 'Thompson', 'lisa@brighthorizons.edu', '+1-555-700-0001', null, 'CEO', 'Executive', 1],
      [null, 'Mark', 'Stevens', 'mark@brighthorizons.edu', '+1-555-700-0003', null, 'CTO', 'Technology', 0],
    ]
  },
  {
    data: ['Arjun Patel', 'arjun@finserve.in', '+91-7900123456', '+91-7900123457',
      'FinServe Capital', 'Finance', 'https://finserve.in', 22000000,
      '1 Nariman Point', 'Mumbai', 'Maharashtra', '400021', 'India',
      'active', 'direct', 'Digital-first financial services and wealth management platform', null],
    contacts: [
      [null, 'Arjun', 'Patel', 'arjun@finserve.in', '+91-7900123456', null, 'Managing Partner', 'Executive', 1],
      [null, 'Deepika', 'Rao', 'deepika@finserve.in', '+91-7900123460', null, 'Head of Technology', 'IT', 0],
      [null, 'Kiran', 'Shah', 'kiran@finserve.in', '+91-7900123461', null, 'VP Operations', 'Operations', 0],
    ]
  },
  {
    data: ['Hans Mueller', 'hans@autowerk.de', '+49-89-12345678', '+49-176-12345678',
      'AutoWerk GmbH', 'Automotive', 'https://autowerk.de', 45000000,
      'Leopoldstraße 50', 'Munich', 'Bavaria', '80802', 'Germany',
      'active', 'trade_show', 'Premium automotive parts manufacturer for European OEMs', null],
    contacts: [
      [null, 'Hans', 'Mueller', 'hans@autowerk.de', '+49-89-12345678', null, 'Geschäftsführer (CEO)', 'Executive', 1],
      [null, 'Eva', 'Schmidt', 'eva@autowerk.de', '+49-89-12345680', null, 'Head of Purchasing', 'Procurement', 0],
    ]
  },
  {
    data: ['Yuki Tanaka', 'yuki@nexgen.jp', '+81-3-12345678', '+81-90-12345678',
      'NexGen Robotics', 'Robotics', 'https://nexgen.jp', 18000000,
      '2-7-1 Marunouchi', 'Tokyo', 'Tokyo', '100-0005', 'Japan',
      'active', 'website', 'Industrial robotics and automation solutions provider', null],
    contacts: [
      [null, 'Yuki', 'Tanaka', 'yuki@nexgen.jp', '+81-3-12345678', null, 'President', 'Executive', 1],
      [null, 'Kenji', 'Sato', 'kenji@nexgen.jp', '+81-3-12345680', null, 'Engineering Director', 'R&D', 0],
    ]
  },
  {
    data: ['Samantha Okafor', 'sam@greenleaf.ng', '+234-1-2345678', '+234-8012345678',
      'GreenLeaf Agritech', 'Agriculture', 'https://greenleaf.ng', 6000000,
      '15 Victoria Island', 'Lagos', 'Lagos', '101233', 'Nigeria',
      'active', 'referral', 'Smart farming and agricultural technology solutions', null],
    contacts: [
      [null, 'Samantha', 'Okafor', 'sam@greenleaf.ng', '+234-1-2345678', null, 'Founder & CEO', 'Executive', 1],
    ]
  },
  {
    data: ['Pierre Dubois', 'pierre@luxecraft.fr', '+33-1-23456789', '+33-6-12345678',
      'LuxeCraft Paris', 'Retail & Luxury', 'https://luxecraft.fr', 35000000,
      '8 Avenue Montaigne', 'Paris', 'Île-de-France', '75008', 'France',
      'active', 'direct', 'Luxury fashion and accessories e-commerce brand', null],
    contacts: [
      [null, 'Pierre', 'Dubois', 'pierre@luxecraft.fr', '+33-1-23456789', null, 'Directeur Général', 'Executive', 1],
      [null, 'Marie', 'Laurent', 'marie@luxecraft.fr', '+33-1-23456790', null, 'Head of Digital', 'Digital', 0],
    ]
  },
  {
    data: ['Omar Hassan', 'omar@petrovision.ae', '+971-4-1234567', '+971-50-1234567',
      'PetroVision Energy', 'Energy', 'https://petrovision.ae', 60000000,
      'Dubai Marina, Tower C', 'Dubai', 'Dubai', '00000', 'UAE',
      'active', 'trade_show', 'Oil & gas analytics and energy consulting firm', null],
    contacts: [
      [null, 'Omar', 'Hassan', 'omar@petrovision.ae', '+971-4-1234567', null, 'Chairman', 'Executive', 1],
      [null, 'Sara', 'Al-Rashid', 'sara@petrovision.ae', '+971-4-1234570', null, 'VP Business Development', 'Sales', 0],
    ]
  },
];

// Assign clients round-robin to employees (and admin)
const allAssignees = [1, ...employeeIds]; // admin + new employees

for (let i = 0; i < clients.length; i++) {
  const c = clients[i];
  // Check if company already exists
  const existingClient = db.prepare('SELECT id FROM clients WHERE company_name = ?').get(c.data[4]);
  if (existingClient) {
    console.log(`   ⏭  ${c.data[4]} already exists, skipping.`);
    continue;
  }

  // Assign round-robin
  c.data[c.data.length - 1] = allAssignees[i % allAssignees.length];

  const result = insertClient.run(...c.data);
  const clientId = result.lastInsertRowid;
  console.log(`   ✅ ${c.data[4]} (${c.data[5]}) — assigned to user ${c.data[c.data.length - 1]}`);

  // Insert contacts
  for (const contact of c.contacts) {
    contact[0] = clientId;
    insertContact.run(...contact);
  }
}

// ============================================================
// EXTRA OPPORTUNITIES for new clients
// ============================================================
const insertOpp = db.prepare(`
  INSERT INTO opportunities (opportunity_name, client_id, contact_id, assigned_user_id, stage, probability, value, expected_close_date, lead_source, type, description, next_step)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

console.log('\n🎯 Adding opportunities...');

// Get new client IDs by company name
function getClientId(companyName) {
  const row = db.prepare('SELECT id FROM clients WHERE company_name = ?').get(companyName);
  return row ? row.id : null;
}
function getFirstContact(clientId) {
  const row = db.prepare('SELECT id FROM contacts WHERE client_id = ? AND is_primary = 1').get(clientId);
  return row ? row.id : null;
}

const opps = [
  { company: 'InnovaTech Pvt Ltd', name: 'Mobile App Platform', stage: 'qualification', value: 120000, date: '2026-07-15', source: 'website', type: 'new_business', desc: 'Cross-platform mobile app development', next: 'Technical assessment call' },
  { company: 'GlobalEdge Consulting', name: 'Digital Transformation Program', stage: 'proposal', value: 750000, date: '2026-06-30', source: 'trade_show', type: 'new_business', desc: 'Enterprise-wide digital transformation initiative', next: 'Present proposal to board' },
  { company: 'FinServe Capital', name: 'Trading Platform Modernization', stage: 'needs_analysis', value: 500000, date: '2026-08-01', source: 'direct', type: 'new_business', desc: 'Modernize algorithmic trading platform', next: 'Architecture review session' },
  { company: 'AutoWerk GmbH', name: 'IoT Factory Monitoring', stage: 'negotiation', value: 340000, date: '2026-05-30', source: 'trade_show', type: 'new_business', desc: 'IoT-based real-time factory floor monitoring', next: 'Final contract review' },
  { company: 'NexGen Robotics', name: 'AI Vision System', stage: 'prospecting', value: 280000, date: '2026-09-15', source: 'website', type: 'new_business', desc: 'Computer vision system for quality inspection', next: 'Initial discovery meeting' },
  { company: 'LuxeCraft Paris', name: 'E-Commerce Replatforming', stage: 'closed_won', value: 420000, date: '2026-03-10', source: 'direct', type: 'new_business', desc: 'Migrate to headless commerce architecture', next: 'Project kickoff completed' },
  { company: 'PetroVision Energy', name: 'Predictive Analytics Dashboard', stage: 'proposal', value: 600000, date: '2026-07-01', source: 'trade_show', type: 'new_business', desc: 'ML-powered predictive maintenance analytics', next: 'Submit technical RFP response' },
  { company: 'GreenLeaf Agritech', name: 'Smart Irrigation System', stage: 'qualification', value: 180000, date: '2026-08-30', source: 'referral', type: 'new_business', desc: 'IoT-based smart irrigation and crop monitoring', next: 'Pilot site evaluation' },
];

const stageProbability = { prospecting: 10, qualification: 20, needs_analysis: 40, proposal: 60, negotiation: 80, closed_won: 100, closed_lost: 0 };

for (const opp of opps) {
  const clientId = getClientId(opp.company);
  if (!clientId) {
    console.log(`   ⚠  Skipping "${opp.name}" — client ${opp.company} not found.`);
    continue;
  }
  const contactId = getFirstContact(clientId);
  const assignee = allAssignees[Math.floor(Math.random() * allAssignees.length)];
  insertOpp.run(opp.name, clientId, contactId, assignee, opp.stage, stageProbability[opp.stage], opp.value, opp.date, opp.source, opp.type, opp.desc, opp.next);
  console.log(`   ✅ ${opp.name} (${opp.stage}) — $${opp.value.toLocaleString()}`);
}

console.log('\n🎉 Extra seed data added successfully!');
console.log('   Login with any new employee: password123');
console.log('   Admin login remains: admin@crm.com / admin123');

db.close();
