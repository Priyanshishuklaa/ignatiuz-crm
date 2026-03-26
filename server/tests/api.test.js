// ============================================================
// CRM PRO — COMPREHENSIVE API TEST SUITE
// Tests every endpoint, RBAC rule, validation, and edge case.
// Run: node tests/api.test.js
// Requires: Server running on http://localhost:5000
// ============================================================

const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

// ---- Test Infrastructure ----
let passed = 0;
let failed = 0;
let total = 0;
const failures = [];

// Tokens stored after login tests
let adminToken = '';
let clientToken = '';
let employeeToken = '';

// IDs created during tests (for cleanup)
let createdUserId = null;
let createdClientId = null;
let createdContactId = null;
let createdOpportunityId = null;
let createdInvoiceId = null;

// ============================================================
// HTTP Helper — Makes requests without external dependencies
// ============================================================
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ============================================================
// Assertion Helpers
// ============================================================
function assert(condition, testName, details = '') {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    const msg = `  ❌ ${testName}${details ? ' — ' + details : ''}`;
    console.log(msg);
    failures.push(msg);
  }
}

function assertEqual(actual, expected, testName) {
  assert(actual === expected, testName, `expected "${expected}", got "${actual}"`);
}

function assertIncludes(arr, value, testName) {
  assert(arr && arr.includes(value), testName, `"${value}" not found in [${arr}]`);
}

function assertGreaterThan(actual, target, testName) {
  assert(actual > target, testName, `expected > ${target}, got ${actual}`);
}

// ============================================================
// TEST RUNNER
// ============================================================
async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║     CRM PRO — API TEST SUITE                     ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ---- 1. HEALTH CHECK ----
  console.log('── 1. HEALTH CHECK ──');
  {
    const res = await request('GET', '/health');
    assertEqual(res.status, 200, 'GET /api/health returns 200');
    assertEqual(res.data.status, 'ok', 'Health check status is "ok"');
    assert(res.data.timestamp, 'Health check includes timestamp');
  }

  // ---- 2. AUTHENTICATION ----
  console.log('\n── 2. AUTHENTICATION (9 tests) ──');
  {
    // 2.1 Admin login
    const adminLogin = await request('POST', '/auth/login', { email: 'admin@crm.com', password: 'admin123' });
    assertEqual(adminLogin.status, 200, 'Admin login succeeds (200)');
    assert(adminLogin.data.token, 'Admin login returns JWT token');
    assertEqual(adminLogin.data.user.role, 'admin', 'Admin user has role "admin"');
    adminToken = adminLogin.data.token;

    // 2.2 Client login
    const clientLogin = await request('POST', '/auth/login', { email: 'sarah@crm.com', password: 'client123' });
    assertEqual(clientLogin.status, 200, 'Client login succeeds (200)');
    assertEqual(clientLogin.data.user.role, 'client', 'Client user has role "client"');
    clientToken = clientLogin.data.token;

    // 2.3 Employee login
    const empLogin = await request('POST', '/auth/login', { email: 'mike@crm.com', password: 'employee123' });
    assertEqual(empLogin.status, 200, 'Employee login succeeds (200)');
    assertEqual(empLogin.data.user.role, 'employee', 'Employee user has role "employee"');
    employeeToken = empLogin.data.token;

    // 2.4 Invalid password
    const badPwd = await request('POST', '/auth/login', { email: 'admin@crm.com', password: 'wrongpassword' });
    assertEqual(badPwd.status, 401, 'Invalid password returns 401');

    // 2.5 Non-existent email
    const noUser = await request('POST', '/auth/login', { email: 'nobody@crm.com', password: 'test' });
    assertEqual(noUser.status, 401, 'Non-existent email returns 401');

    // 2.6 Empty body
    const empty = await request('POST', '/auth/login', {});
    assertEqual(empty.status, 400, 'Empty login body returns 400');

    // 2.7 GET /me with valid token
    const me = await request('GET', '/auth/me', null, adminToken);
    assertEqual(me.status, 200, 'GET /auth/me with token returns 200');
    assertEqual(me.data.email, 'admin@crm.com', 'GET /auth/me returns correct email');

    // 2.8 GET /me without token
    const noToken = await request('GET', '/auth/me');
    assertEqual(noToken.status, 401, 'GET /auth/me without token returns 401');

    // 2.9 Invalid token
    const badToken = await request('GET', '/auth/me', null, 'invalid.jwt.token');
    assertEqual(badToken.status, 401, 'GET /auth/me with invalid token returns 401');
  }

  // ---- 3. USER MANAGEMENT ----
  console.log('\n── 3. USER MANAGEMENT (12 tests) ──');
  {
    // 3.1 List users as admin
    const listAdmin = await request('GET', '/users', null, adminToken);
    assertEqual(listAdmin.status, 200, 'Admin can list all users');
    assertGreaterThan(listAdmin.data.length, 0, 'User list is not empty');

    // 3.2 List users as client (should still return, but no write access)
    const listClient = await request('GET', '/users', null, clientToken);
    assertEqual(listClient.status, 200, 'Client can list users (read access)');

    // 3.3 Create user (admin)
    const createUser = await request('POST', '/users', {
      name: 'Test User',
      email: 'test@crm.com',
      password: 'test123',
      role: 'employee',
      phone: '+1-555-999-0001',
      department: 'QA',
      designation: 'Tester'
    }, adminToken);
    assertEqual(createUser.status, 201, 'Admin can create a user (201)');
    assertEqual(createUser.data.name, 'Test User', 'Created user has correct name');
    assertEqual(createUser.data.role, 'employee', 'Created user has correct role');
    createdUserId = createUser.data.id;

    // 3.4 Duplicate email
    const dupEmail = await request('POST', '/users', {
      name: 'Dup User', email: 'test@crm.com', password: 'test123'
    }, adminToken);
    assertEqual(dupEmail.status, 409, 'Duplicate email returns 409');

    // 3.5 Missing required fields
    const missingName = await request('POST', '/users', { email: 'x@y.com', password: '123' }, adminToken);
    assertEqual(missingName.status, 400, 'Missing name returns 400');

    // 3.6 Create user as client (should fail)
    const clientCreate = await request('POST', '/users', {
      name: 'Nope', email: 'nope@crm.com', password: 'test123'
    }, clientToken);
    assertEqual(clientCreate.status, 403, 'Client cannot create users (403)');

    // 3.7 Get single user
    const getUser = await request('GET', `/users/${createdUserId}`, null, adminToken);
    assertEqual(getUser.status, 200, 'GET user by ID returns 200');
    assertEqual(getUser.data.email, 'test@crm.com', 'Retrieved user has correct email');

    // 3.8 Update user
    const updateUser = await request('PUT', `/users/${createdUserId}`, {
      name: 'Test User Updated',
      department: 'Engineering'
    }, adminToken);
    assertEqual(updateUser.status, 200, 'Admin can update a user');
    assertEqual(updateUser.data.name, 'Test User Updated', 'User name updated correctly');
    assertEqual(updateUser.data.department, 'Engineering', 'User department updated correctly');

    // 3.9 Login with newly created user
    const newUserLogin = await request('POST', '/auth/login', { email: 'test@crm.com', password: 'test123' });
    assertEqual(newUserLogin.status, 200, 'Newly created user can login');

    // 3.10 Update user password then login with new password
    await request('PUT', `/users/${createdUserId}`, { password: 'newpass456' }, adminToken);
    const newPwdLogin = await request('POST', '/auth/login', { email: 'test@crm.com', password: 'newpass456' });
    assertEqual(newPwdLogin.status, 200, 'User can login with updated password');

    // 3.11 Non-existent user
    const noUser = await request('GET', '/users/99999', null, adminToken);
    assertEqual(noUser.status, 404, 'GET non-existent user returns 404');

    // 3.12 Update as client (should fail)
    const clientUpdate = await request('PUT', `/users/${createdUserId}`, { name: 'Hacked' }, clientToken);
    assertEqual(clientUpdate.status, 403, 'Client cannot update users (403)');
  }

  // ---- 4. CLIENT MANAGEMENT ----
  console.log('\n── 4. CLIENT MANAGEMENT (12 tests) ──');
  {
    // 4.1 List clients as admin
    const listAdmin = await request('GET', '/clients', null, adminToken);
    assertEqual(listAdmin.status, 200, 'Admin can list all clients');
    assertGreaterThan(listAdmin.data.length, 0, 'Client list is not empty');

    // 4.2 Verify client list has aggregated fields
    const firstClient = listAdmin.data[0];
    assert(firstClient.contact_count !== undefined, 'Client list includes contact_count');
    assert(firstClient.opportunity_count !== undefined, 'Client list includes opportunity_count');
    assert(firstClient.total_revenue !== undefined, 'Client list includes total_revenue');

    // 4.3 List clients as client user (only assigned)
    const listClient = await request('GET', '/clients', null, clientToken);
    assertEqual(listClient.status, 200, 'Client role can list clients');
    // Sarah (user 2) is assigned to clients 1 and 2
    assert(listClient.data.length <= listAdmin.data.length, 'Client user sees fewer or equal clients than admin');

    // 4.4 Create client (admin)
    const createClient = await request('POST', '/clients', {
      client_name: 'Test Client Corp',
      email: 'testclient@test.com',
      phone: '+1-555-888-0001',
      company_name: 'Test Corp International',
      industry: 'Technology',
      website: 'https://testcorp.com',
      annual_revenue: 1500000,
      status: 'active',
      source: 'website',
      description: 'Created by test suite',
      billing_street: '100 Test Ave',
      billing_city: 'Test City',
      billing_state: 'TS',
      billing_zip: '12345',
      billing_country: 'USA',
      assigned_user_id: 1
    }, adminToken);
    assertEqual(createClient.status, 201, 'Admin can create a client (201)');
    assertEqual(createClient.data.client_name, 'Test Client Corp', 'Created client has correct name');
    assertEqual(createClient.data.industry, 'Technology', 'Created client has correct industry');
    createdClientId = createClient.data.id;

    // 4.5 Missing client name
    const noName = await request('POST', '/clients', { company_name: 'Oops' }, adminToken);
    assertEqual(noName.status, 400, 'Missing client name returns 400');

    // 4.6 Create as client user (should fail)
    const clientCreate = await request('POST', '/clients', {
      client_name: 'Nope'
    }, clientToken);
    assertEqual(clientCreate.status, 403, 'Client cannot create clients (403)');

    // 4.7 Get client detail (includes contacts, opportunities, invoices)
    const detail = await request('GET', '/clients/1', null, adminToken);
    assertEqual(detail.status, 200, 'GET client detail returns 200');
    assert(Array.isArray(detail.data.contacts), 'Detail includes contacts array');
    assert(Array.isArray(detail.data.opportunities), 'Detail includes opportunities array');
    assert(Array.isArray(detail.data.invoices), 'Detail includes invoices array');

    // 4.8 Client user cannot view unassigned client
    const unassigned = await request('GET', '/clients/3', null, clientToken);
    // Client 3 (Strategic Minds) is assigned to user 1 (admin), not user 2 (sarah)
    assertEqual(unassigned.status, 403, 'Client user cannot view unassigned client (403)');

    // 4.9 Update client (admin)
    const updateClient = await request('PUT', `/clients/${createdClientId}`, {
      client_name: 'Test Client Corp Updated',
      annual_revenue: 2000000
    }, adminToken);
    assertEqual(updateClient.status, 200, 'Admin can update a client');
    assertEqual(updateClient.data.client_name, 'Test Client Corp Updated', 'Client name updated');

    // 4.10 Add contact to client
    const addContact = await request('POST', `/clients/${createdClientId}/contacts`, {
      first_name: 'John',
      last_name: 'TestContact',
      email: 'john@testcorp.com',
      phone: '+1-555-777-0001',
      designation: 'QA Lead',
      department: 'Quality',
      is_primary: true
    }, adminToken);
    assertEqual(addContact.status, 201, 'Admin can add a contact (201)');
    assertEqual(addContact.data.first_name, 'John', 'Contact has correct first name');
    assertEqual(addContact.data.is_primary, 1, 'Contact is marked as primary');
    createdContactId = addContact.data.id;

    // 4.11 Verify contact appears in client detail
    const detailWithContact = await request('GET', `/clients/${createdClientId}`, null, adminToken);
    assertGreaterThan(detailWithContact.data.contacts.length, 0, 'Client detail includes the added contact');

    // 4.12 Non-existent client
    const noClient = await request('GET', '/clients/99999', null, adminToken);
    assertEqual(noClient.status, 404, 'GET non-existent client returns 404');
  }

  // ---- 5. OPPORTUNITY MANAGEMENT ----
  console.log('\n── 5. OPPORTUNITY MANAGEMENT (10 tests) ──');
  {
    // 5.1 List opportunities as admin
    const listAdmin = await request('GET', '/opportunities', null, adminToken);
    assertEqual(listAdmin.status, 200, 'Admin can list all opportunities');
    assertGreaterThan(listAdmin.data.length, 0, 'Opportunity list is not empty');

    // 5.2 Verify joined fields
    const firstOpp = listAdmin.data[0];
    assert(firstOpp.client_name, 'Opportunity includes client_name');
    assert(firstOpp.company_name, 'Opportunity includes company_name');

    // 5.3 List as client (only their assigned clients' opportunities)
    const listClient = await request('GET', '/opportunities', null, clientToken);
    assertEqual(listClient.status, 200, 'Client can list opportunities');

    // 5.4 Create opportunity (admin)
    const createOpp = await request('POST', '/opportunities', {
      opportunity_name: 'Test Deal',
      client_id: createdClientId,
      contact_id: createdContactId,
      assigned_user_id: 1,
      stage: 'proposal',
      value: 200000,
      expected_close_date: '2026-06-15',
      lead_source: 'website',
      type: 'new_business',
      description: 'Created by test suite',
      next_step: 'Send proposal document'
    }, adminToken);
    assertEqual(createOpp.status, 201, 'Admin can create an opportunity (201)');
    assertEqual(createOpp.data.opportunity_name, 'Test Deal', 'Created opp has correct name');
    assertEqual(createOpp.data.probability, 60, 'Auto-probability set to 60 for "proposal" stage');
    createdOpportunityId = createOpp.data.id;

    // 5.5 Missing required fields
    const missingFields = await request('POST', '/opportunities', { client_id: 1 }, adminToken);
    assertEqual(missingFields.status, 400, 'Missing opportunity name returns 400');

    // 5.6 Get opportunity detail
    const detail = await request('GET', `/opportunities/${createdOpportunityId}`, null, adminToken);
    assertEqual(detail.status, 200, 'GET opportunity detail returns 200');
    assertEqual(detail.data.stage, 'proposal', 'Detail shows correct stage');

    // 5.7 Update stage → probability auto-updates
    const updateStage = await request('PUT', `/opportunities/${createdOpportunityId}`, {
      stage: 'negotiation'
    }, adminToken);
    assertEqual(updateStage.status, 200, 'Admin can update opportunity stage');
    assertEqual(updateStage.data.stage, 'negotiation', 'Stage updated to negotiation');
    assertEqual(updateStage.data.probability, 80, 'Probability auto-updated to 80');

    // 5.8 Create as client (should fail)
    const clientCreate = await request('POST', '/opportunities', {
      opportunity_name: 'Nope', client_id: 1
    }, clientToken);
    assertEqual(clientCreate.status, 403, 'Client cannot create opportunities (403)');

    // 5.9 Non-existent opportunity
    const noOpp = await request('GET', '/opportunities/99999', null, adminToken);
    assertEqual(noOpp.status, 404, 'GET non-existent opportunity returns 404');

    // 5.10 Verify all 7 seeded stages are represented
    const allOpps = await request('GET', '/opportunities', null, adminToken);
    const stages = [...new Set(allOpps.data.map(o => o.stage))];
    const expectedStages = ['prospecting', 'qualification', 'needs_analysis', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
    let allStagesPresent = true;
    for (const s of expectedStages) {
      if (!stages.includes(s)) allStagesPresent = false;
    }
    assert(allStagesPresent, 'All 7 pipeline stages are represented in seed data');
  }

  // ---- 6. INVOICE MANAGEMENT ----
  console.log('\n── 6. INVOICE MANAGEMENT (12 tests) ──');
  {
    // 6.1 List invoices as admin
    const listAdmin = await request('GET', '/invoices', null, adminToken);
    assertEqual(listAdmin.status, 200, 'Admin can list all invoices');
    assertGreaterThan(listAdmin.data.length, 0, 'Invoice list is not empty');

    // 6.2 Verify list includes item_count
    const firstInv = listAdmin.data[0];
    assert(firstInv.item_count !== undefined, 'Invoice list includes item_count');
    assert(firstInv.client_name, 'Invoice list includes client_name');

    // 6.3 Get invoice with line items
    const detail = await request('GET', '/invoices/1', null, adminToken);
    assertEqual(detail.status, 200, 'GET invoice detail returns 200');
    assert(Array.isArray(detail.data.items), 'Invoice detail includes items array');
    assertGreaterThan(detail.data.items.length, 0, 'Invoice has line items');
    assert(detail.data.invoice_number, 'Invoice has invoice_number');

    // 6.4 Create invoice with line items + verify calculations
    const createInvoice = await request('POST', '/invoices', {
      client_id: createdClientId,
      contact_id: createdContactId,
      opportunity_id: createdOpportunityId,
      subject: 'Test Invoice - Full Suite',
      invoice_date: '2026-03-26',
      due_date: '2026-04-26',
      status: 'draft',
      discount_type: 'percent',
      discount_value: 10,
      tax_rate: 18,
      shipping_charges: 500,
      adjustment: -100,
      notes: 'Created by test suite',
      payment_terms: 'Net 30',
      items: [
        { description: 'Development Services', quantity: 100, unit: 'Hours', rate: 200, discount_percent: 0 },
        { description: 'Design Services', quantity: 50, unit: 'Hours', rate: 150, discount_percent: 5 },
        { description: 'License Fee', quantity: 1, unit: 'Licenses', rate: 5000, discount_percent: 0 }
      ]
    }, adminToken);
    assertEqual(createInvoice.status, 201, 'Admin can create an invoice (201)');
    assert(createInvoice.data.invoice_number, 'Invoice has auto-generated number');
    assert(createInvoice.data.invoice_number.startsWith('INV-'), 'Invoice number starts with INV-');
    createdInvoiceId = createInvoice.data.id;

    // 6.5 Verify financial calculations
    // Line 1: 100 × 200 = 20000
    // Line 2: 50 × 150 × (1 - 0.05) = 7125
    // Line 3: 1 × 5000 = 5000
    // Subtotal = 32125
    // Discount = 10% of 32125 = 3212.5
    // Taxable = 32125 - 3212.5 = 28912.5
    // Tax = 18% of 28912.5 = 5204.25
    // Total = 28912.5 + 5204.25 + 500 + (-100) = 34516.75
    assertEqual(createInvoice.data.subtotal, 32125, 'Subtotal calculated correctly (32125)');
    assertEqual(createInvoice.data.discount_amount, 3212.5, 'Discount amount calculated correctly (3212.5)');
    assertEqual(createInvoice.data.tax_amount, 5204.25, 'Tax amount calculated correctly (5204.25)');
    assertEqual(createInvoice.data.total_amount, 34516.75, 'Total amount calculated correctly (34516.75)');

    // 6.6 Empty items (should fail)
    const emptyItems = await request('POST', '/invoices', {
      client_id: 1, items: []
    }, adminToken);
    assertEqual(emptyItems.status, 400, 'Empty items array returns 400');

    // 6.7 Missing client (should fail)
    const noClient = await request('POST', '/invoices', {
      items: [{ description: 'Test', quantity: 1, rate: 100 }]
    }, adminToken);
    assertEqual(noClient.status, 400, 'Missing client returns 400');

    // 6.8 Flat discount calculation
    const flatDiscount = await request('POST', '/invoices', {
      client_id: 1,
      discount_type: 'flat',
      discount_value: 1000,
      tax_rate: 10,
      items: [{ description: 'Service', quantity: 10, unit: 'Hours', rate: 500 }]
    }, adminToken);
    assertEqual(flatDiscount.status, 201, 'Invoice with flat discount created');
    // Subtotal = 5000, Discount = 1000, Taxable = 4000, Tax = 400, Total = 4400
    assertEqual(flatDiscount.data.subtotal, 5000, 'Flat discount: subtotal = 5000');
    assertEqual(flatDiscount.data.discount_amount, 1000, 'Flat discount: discount = 1000');
    assertEqual(flatDiscount.data.tax_amount, 400, 'Flat discount: tax = 400');
    assertEqual(flatDiscount.data.total_amount, 4400, 'Flat discount: total = 4400');

    // 6.9 Update invoice status
    const updateStatus = await request('PUT', `/invoices/${createdInvoiceId}`, {
      status: 'sent'
    }, adminToken);
    assertEqual(updateStatus.status, 200, 'Admin can update invoice status');
    assertEqual(updateStatus.data.status, 'sent', 'Invoice status updated to "sent"');

    // 6.10 Update invoice with new items (recalculates)
    const updateItems = await request('PUT', `/invoices/${createdInvoiceId}`, {
      discount_type: 'flat',
      discount_value: 500,
      tax_rate: 10,
      shipping_charges: 0,
      adjustment: 0,
      items: [
        { description: 'Updated Service', quantity: 20, unit: 'Hours', rate: 300 }
      ]
    }, adminToken);
    assertEqual(updateItems.status, 200, 'Admin can update invoice with new items');
    // Subtotal = 6000, Discount = 500, Taxable = 5500, Tax = 550, Total = 6050
    assertEqual(updateItems.data.subtotal, 6000, 'Updated subtotal = 6000');
    assertEqual(updateItems.data.total_amount, 6050, 'Updated total = 6050');
    assertEqual(updateItems.data.items.length, 1, 'Old items replaced with 1 new item');

    // 6.11 Unique invoice numbers
    const inv1 = createInvoice.data.invoice_number;
    const inv2 = flatDiscount.data.invoice_number;
    assert(inv1 !== inv2, 'Each invoice gets a unique invoice number');

    // 6.12 Non-existent invoice
    const noInv = await request('GET', '/invoices/99999', null, adminToken);
    assertEqual(noInv.status, 404, 'GET non-existent invoice returns 404');
  }

  // ---- 7. DASHBOARD ----
  console.log('\n── 7. DASHBOARD (6 tests) ──');
  {
    // 7.1 Admin dashboard
    const adminDash = await request('GET', '/dashboard', null, adminToken);
    assertEqual(adminDash.status, 200, 'Admin dashboard returns 200');
    assert(adminDash.data.totalRevenue !== undefined, 'Dashboard includes totalRevenue');
    assert(adminDash.data.totalClients !== undefined, 'Dashboard includes totalClients');
    assert(adminDash.data.pipelineValue !== undefined, 'Dashboard includes pipelineValue');
    assert(adminDash.data.overdueRevenue !== undefined, 'Dashboard includes overdueRevenue');

    // 7.2 Dashboard includes arrays
    assert(Array.isArray(adminDash.data.opportunityStages), 'Dashboard includes opportunityStages array');
    assert(Array.isArray(adminDash.data.topClients), 'Dashboard includes topClients array');
    assert(Array.isArray(adminDash.data.recentOpportunities), 'Dashboard includes recentOpportunities');
    assert(Array.isArray(adminDash.data.recentInvoices), 'Dashboard includes recentInvoices');

    // 7.3 Revenue matches paid invoices
    const paidInvoices = await request('GET', '/invoices', null, adminToken);
    const paidTotal = paidInvoices.data
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + (i.total_amount || 0), 0);
    assertEqual(adminDash.data.totalRevenue, paidTotal, 'Dashboard totalRevenue matches sum of paid invoices');

    // 7.4 Client dashboard (limited stats)
    const clientDash = await request('GET', '/dashboard', null, clientToken);
    assertEqual(clientDash.status, 200, 'Client dashboard returns 200');
    assert(clientDash.data.totalClients !== undefined, 'Client dashboard includes totalClients');
    assert(clientDash.data.totalRevenue !== undefined, 'Client dashboard includes totalRevenue');
    // Client dashboard should NOT have pipeline chart data
    assert(!clientDash.data.opportunityStages, 'Client dashboard does NOT include opportunityStages');

    // 7.5 Employee dashboard
    const empDash = await request('GET', '/dashboard', null, employeeToken);
    assertEqual(empDash.status, 200, 'Employee dashboard returns 200');

    // 7.6 No token → 401
    const noToken = await request('GET', '/dashboard');
    assertEqual(noToken.status, 401, 'Dashboard without token returns 401');
  }

  // ---- 8. RBAC ENFORCEMENT ----
  console.log('\n── 8. RBAC ENFORCEMENT (8 tests) ──');
  {
    // 8.1 Client cannot create users
    const r1 = await request('POST', '/users', { name: 'X', email: 'x@y.com', password: '123' }, clientToken);
    assertEqual(r1.status, 403, 'Client cannot POST /users (403)');

    // 8.2 Client cannot update users
    const r2 = await request('PUT', '/users/1', { name: 'Hacked' }, clientToken);
    assertEqual(r2.status, 403, 'Client cannot PUT /users/:id (403)');

    // 8.3 Client cannot delete users
    const r3 = await request('DELETE', '/users/3', null, clientToken);
    assertEqual(r3.status, 403, 'Client cannot DELETE /users/:id (403)');

    // 8.4 Client cannot create clients
    const r4 = await request('POST', '/clients', { client_name: 'Nope' }, clientToken);
    assertEqual(r4.status, 403, 'Client cannot POST /clients (403)');

    // 8.5 Client cannot update clients
    const r5 = await request('PUT', '/clients/1', { client_name: 'Hacked' }, clientToken);
    assertEqual(r5.status, 403, 'Client cannot PUT /clients/:id (403)');

    // 8.6 Client cannot delete clients
    const r6 = await request('DELETE', '/clients/1', null, clientToken);
    assertEqual(r6.status, 403, 'Client cannot DELETE /clients/:id (403)');

    // 8.7 Employee cannot create opportunities
    const r7 = await request('POST', '/opportunities', { opportunity_name: 'Nope', client_id: 1 }, employeeToken);
    assertEqual(r7.status, 403, 'Employee cannot POST /opportunities (403)');

    // 8.8 Employee cannot create invoices
    const r8 = await request('POST', '/invoices', {
      client_id: 1, items: [{ description: 'X', quantity: 1, rate: 100 }]
    }, employeeToken);
    assertEqual(r8.status, 403, 'Employee cannot POST /invoices (403)');
  }

  // ---- 9. EDGE CASES ----
  console.log('\n── 9. EDGE CASES (8 tests) ──');
  {
    // 9.1 Admin cannot delete self
    const selfDelete = await request('DELETE', '/users/1', null, adminToken);
    assertEqual(selfDelete.status, 400, 'Admin cannot delete own account (400)');

    // 9.2 Delete non-existent user
    const noUser = await request('DELETE', '/users/99999', null, adminToken);
    assertEqual(noUser.status, 404, 'DELETE non-existent user returns 404');

    // 9.3 Delete non-existent client
    const noClient = await request('DELETE', '/clients/99999', null, adminToken);
    assertEqual(noClient.status, 404, 'DELETE non-existent client returns 404');

    // 9.4 Delete non-existent opportunity
    const noOpp = await request('DELETE', '/opportunities/99999', null, adminToken);
    assertEqual(noOpp.status, 404, 'DELETE non-existent opportunity returns 404');

    // 9.5 Delete non-existent invoice
    const noInv = await request('DELETE', '/invoices/99999', null, adminToken);
    assertEqual(noInv.status, 404, 'DELETE non-existent invoice returns 404');

    // 9.6 Update non-existent client
    const updateNoClient = await request('PUT', '/clients/99999', { client_name: 'X' }, adminToken);
    assertEqual(updateNoClient.status, 404, 'PUT non-existent client returns 404');

    // 9.7 Update non-existent opportunity
    const updateNoOpp = await request('PUT', '/opportunities/99999', { stage: 'closed_won' }, adminToken);
    assertEqual(updateNoOpp.status, 404, 'PUT non-existent opportunity returns 404');

    // 9.8 Update non-existent invoice
    const updateNoInv = await request('PUT', '/invoices/99999', { status: 'paid' }, adminToken);
    assertEqual(updateNoInv.status, 404, 'PUT non-existent invoice returns 404');
  }

  // ---- 10. CONTACT MANAGEMENT ----
  console.log('\n── 10. CONTACT MANAGEMENT (4 tests) ──');
  {
    // 10.1 Add contact with missing fields
    const missingContact = await request('POST', `/clients/${createdClientId}/contacts`, {
      first_name: 'OnlyFirst'
    }, adminToken);
    assertEqual(missingContact.status, 400, 'Missing last_name returns 400');

    // 10.2 Add contact to non-existent client
    const noClient = await request('POST', '/clients/99999/contacts', {
      first_name: 'John', last_name: 'Doe'
    }, adminToken);
    assertEqual(noClient.status, 404, 'Add contact to non-existent client returns 404');

    // 10.3 Delete contact
    const deleteContact = await request('DELETE', `/clients/${createdClientId}/contacts/${createdContactId}`, null, adminToken);
    assertEqual(deleteContact.status, 200, 'Admin can delete a contact');

    // 10.4 Delete non-existent contact
    const noContact = await request('DELETE', `/clients/${createdClientId}/contacts/99999`, null, adminToken);
    assertEqual(noContact.status, 404, 'DELETE non-existent contact returns 404');
  }

  // ---- 11. CLEANUP ----
  console.log('\n── 11. CLEANUP (4 tests) ──');
  {
    // 11.1 Delete test invoice
    if (createdInvoiceId) {
      const delInv = await request('DELETE', `/invoices/${createdInvoiceId}`, null, adminToken);
      assertEqual(delInv.status, 200, 'Test invoice deleted');
    }

    // 11.2 Delete flat discount invoice (the second one we created)
    // Find it by looking for our flat discount invoice
    const allInvoices = await request('GET', '/invoices', null, adminToken);
    const flatDiscInv = allInvoices.data.find(i => i.subtotal === 5000 && i.total_amount === 4400);
    if (flatDiscInv) {
      const delFlat = await request('DELETE', `/invoices/${flatDiscInv.id}`, null, adminToken);
      assertEqual(delFlat.status, 200, 'Flat discount test invoice deleted');
    }

    // 11.3 Delete test client (cascades to opportunities)
    if (createdClientId) {
      const delClient = await request('DELETE', `/clients/${createdClientId}`, null, adminToken);
      assertEqual(delClient.status, 200, 'Test client deleted (cascades contacts, opps)');
    }

    // 11.4 Verify cascade delete — opportunity should be gone
    if (createdOpportunityId) {
      const checkOpp = await request('GET', `/opportunities/${createdOpportunityId}`, null, adminToken);
      assertEqual(checkOpp.status, 404, 'Opportunity cascade-deleted with client');
    }

    // 11.5 Delete test user
    if (createdUserId) {
      const delUser = await request('DELETE', `/users/${createdUserId}`, null, adminToken);
      assertEqual(delUser.status, 200, 'Test user deleted');
    }

    // 11.6 Verify deleted user cannot login
    const deadLogin = await request('POST', '/auth/login', { email: 'test@crm.com', password: 'newpass456' });
    assertEqual(deadLogin.status, 401, 'Deleted user cannot login');
  }

  // ============================================================
  // FINAL REPORT
  // ============================================================
  console.log('\n══════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${total} total`);
  console.log('══════════════════════════════════════════════════');

  if (failures.length > 0) {
    console.log('\n  FAILURES:');
    failures.forEach(f => console.log(f));
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

// ============================================================
// RUN
// ============================================================
runTests().catch(err => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
