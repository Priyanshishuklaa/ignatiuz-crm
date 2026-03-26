// ============================================================
// INVOICES PAGE — Most complex page in the CRM
// Features: list table, create with line items, detail view,
//           auto-calculations, status management
// ============================================================

import { useState, useEffect } from 'react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { Plus, Eye, Trash2, X, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n || 0);

const STATUS_BADGE = {
  draft: 'badge-neutral',
  sent: 'badge-info',
  paid: 'badge-success',
  overdue: 'badge-danger',
  cancelled: 'badge-neutral',
  partially_paid: 'badge-warning'
};

const UNITS = ['Units', 'Hours', 'Project', 'Licenses', 'Months', 'Days'];
const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];

export default function InvoicesPage() {
  const { isAdmin } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState(null);

  // Form state
  const emptyItem = { description: '', quantity: 1, unit: 'Hours', rate: 0, discount_percent: 0 };
  const [form, setForm] = useState({
    client_id: '', contact_id: '', opportunity_id: '', subject: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '', payment_terms: 'Net 30',
    discount_type: 'flat', discount_value: 0, tax_rate: 18,
    shipping_charges: 0, adjustment: 0, notes: '', terms: '',
    items: [{ ...emptyItem }]
  });

  const fetchInvoices = () => {
    api.get('/invoices').then(res => setInvoices(res.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoices();
    if (isAdmin) {
      api.get('/clients').then(res => setClients(res.data)).catch(() => {});
    }
  }, [isAdmin]);

  // Load contacts + opportunities when client changes
  const loadClientData = async (clientId) => {
    if (!clientId) { setContacts([]); setOpportunities([]); return; }
    try {
      const res = await api.get(`/clients/${clientId}`);
      setContacts(res.data.contacts || []);
      setOpportunities(res.data.opportunities || []);
      // Auto-fill billing address
      setForm(prev => ({
        ...prev,
        billing_street: res.data.billing_street || '',
        billing_city: res.data.billing_city || '',
        billing_state: res.data.billing_state || '',
        billing_zip: res.data.billing_zip || '',
        billing_country: res.data.billing_country || ''
      }));
    } catch { setContacts([]); setOpportunities([]); }
  };

  // Calculate totals live
  const calcTotals = () => {
    const subtotal = form.items.reduce((sum, item) => {
      return sum + ((item.quantity || 0) * (item.rate || 0) * (1 - (item.discount_percent || 0) / 100));
    }, 0);
    let discountAmount = form.discount_type === 'percent'
      ? subtotal * (form.discount_value || 0) / 100
      : (form.discount_value || 0);
    const taxable = subtotal - discountAmount;
    const taxAmount = taxable * (form.tax_rate || 0) / 100;
    const total = taxable + taxAmount + (form.shipping_charges || 0) + (form.adjustment || 0);
    return { subtotal, discountAmount, taxAmount, total };
  };

  const openCreate = () => {
    setContacts([]);
    setOpportunities([]);
    setForm({
      client_id: '', contact_id: '', opportunity_id: '', subject: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '', payment_terms: 'Net 30',
      discount_type: 'flat', discount_value: 0, tax_rate: 18,
      shipping_charges: 0, adjustment: 0, notes: '', terms: '',
      items: [{ ...emptyItem }]
    });
    setShowCreateModal(true);
  };

  const viewDetail = async (invoiceId) => {
    try {
      const res = await api.get(`/invoices/${invoiceId}`);
      setDetailInvoice(res.data);
      setShowDetailModal(true);
    } catch { toast.error('Failed to load invoice'); }
  };

  // Inline status change
  const handleStatusChange = async (inv, newStatus) => {
    try {
      await api.put(`/invoices/${inv.id}`, { status: newStatus });
      toast.success('Status updated');
      fetchInvoices();
    } catch { toast.error('Update failed'); }
  };

  const handleSubmit = async () => {
    try {
      await api.post('/invoices', form);
      toast.success('Invoice created');
      setShowCreateModal(false);
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create invoice');
    }
  };

  const handleDelete = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.invoice_number}?`)) return;
    try {
      await api.delete(`/invoices/${inv.id}`);
      toast.success('Invoice deleted');
      fetchInvoices();
    } catch { toast.error('Delete failed'); }
  };

  // Line item helpers
  const addItem = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] });
  const removeItem = (index) => {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };
  const updateItem = (index, field, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    setForm({ ...form, items });
  };

  // Stats
  const totalInvoices = invoices.length;
  const collected = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_amount, 0);
  const pending = invoices.filter(i => ['sent', 'draft', 'partially_paid'].includes(i.status)).reduce((s, i) => s + i.total_amount, 0);
  const overdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total_amount, 0);
  const totals = calcTotals();

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Invoices</h1>
        {isAdmin && (
          <div className="page-header-actions">
            <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Create Invoice</button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-card-label">Total Invoices</div><div className="stat-card-value">{totalInvoices}</div></div>
        <div className="stat-card"><div className="stat-card-header"><span className="stat-card-label">Collected</span><span className="badge badge-success">Paid</span></div><div className="stat-card-value" style={{ color: 'var(--success)' }}>{fmt(collected)}</div></div>
        <div className="stat-card"><div className="stat-card-label">Pending</div><div className="stat-card-value">{fmt(pending)}</div></div>
        <div className="stat-card"><div className="stat-card-header"><span className="stat-card-label">Overdue</span>{overdue > 0 && <span className="badge badge-danger">Attention</span>}</div><div className="stat-card-value" style={{ color: overdue > 0 ? 'var(--danger)' : 'inherit' }}>{fmt(overdue)}</div></div>
      </div>

      {/* Invoice Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr><th>Invoice #</th><th>Subject</th><th>Client</th><th>Date</th><th>Due</th><th>Items</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id}>
                <td className="table-clickable" onClick={() => viewDetail(inv.id)} style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                <td style={{ color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.subject || '—'}</td>
                <td><div style={{ fontWeight: 500 }}>{inv.client_name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.company_name}</div></td>
                <td style={{ color: 'var(--text-secondary)' }}>{inv.invoice_date}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{inv.due_date || '—'}</td>
                <td>{inv.item_count}</td>
                <td style={{ fontWeight: 600 }}>{fmt(inv.total_amount)}</td>
                <td>
                  {isAdmin ? (
                    <select className="inline-select" value={inv.status} onChange={e => handleStatusChange(inv, e.target.value)}>
                      {['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partially_paid'].map(s => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`badge ${STATUS_BADGE[inv.status] || 'badge-neutral'}`}>{inv.status}</span>
                  )}
                </td>
                <td>
                  <div className="table-actions">
                    <button className="btn-icon btn-ghost" onClick={() => viewDetail(inv.id)} title="View"><Eye size={14} /></button>
                    {isAdmin && <button className="btn-icon btn-ghost" onClick={() => handleDelete(inv)} title="Delete"><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && <div className="table-empty">No invoices found</div>}
      </div>

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={detailInvoice ? `${detailInvoice.invoice_number}` : ''}
        wide
        footer={
          <>
            {isAdmin && detailInvoice && <button className="btn btn-danger btn-sm" onClick={() => { setShowDetailModal(false); handleDelete(detailInvoice); }}>Delete</button>}
            <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Close</button>
          </>
        }
      >
        {detailInvoice && (
          <>
            {/* Header with status */}
            <div className="invoice-detail-header">
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 8 }}>Bill To</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{detailInvoice.client_name}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{detailInvoice.company_name}</div>
                {detailInvoice.contact_name && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Attn: {detailInvoice.contact_name}</div>}
                {detailInvoice.billing_street && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                    {[detailInvoice.billing_street, detailInvoice.billing_city, detailInvoice.billing_state, detailInvoice.billing_zip, detailInvoice.billing_country].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${STATUS_BADGE[detailInvoice.status] || 'badge-neutral'}`} style={{ marginBottom: 8, display: 'inline-flex' }}>{detailInvoice.status}</span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Date: {detailInvoice.invoice_date}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Due: {detailInvoice.due_date || '—'}</div>
                {detailInvoice.subject && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Subject: {detailInvoice.subject}</div>}
                {detailInvoice.opportunity_name && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Opportunity: {detailInvoice.opportunity_name}</div>}
              </div>
            </div>

            {/* Line Items Table */}
            <table className="table" style={{ marginBottom: 20 }}>
              <thead>
                <tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {(detailInvoice.items || []).map((item, i) => (
                  <tr key={item.id}>
                    <td>{i + 1}</td>
                    <td><div style={{ fontWeight: 500 }}>{item.description}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.unit}</div></td>
                    <td>{item.quantity}</td>
                    <td>{fmt(item.rate)}</td>
                    <td style={{ fontWeight: 500 }}>{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="invoice-totals">
              <div className="invoice-totals-row"><span>Subtotal</span><span>{fmt(detailInvoice.subtotal)}</span></div>
              {detailInvoice.discount_amount > 0 && (
                <div className="invoice-totals-row"><span>Discount ({detailInvoice.discount_type === 'percent' ? `${detailInvoice.discount_value}%` : 'Flat'})</span><span className="discount-amount">-{fmt(detailInvoice.discount_amount)}</span></div>
              )}
              {detailInvoice.tax_amount > 0 && (
                <div className="invoice-totals-row"><span>Tax ({detailInvoice.tax_rate}%)</span><span>{fmt(detailInvoice.tax_amount)}</span></div>
              )}
              {detailInvoice.shipping_charges > 0 && (
                <div className="invoice-totals-row"><span>Shipping</span><span>{fmt(detailInvoice.shipping_charges)}</span></div>
              )}
              {detailInvoice.adjustment !== 0 && (
                <div className="invoice-totals-row"><span>Adjustment</span><span>{fmt(detailInvoice.adjustment)}</span></div>
              )}
              <div className="invoice-totals-row total"><span>Total</span><span>{fmt(detailInvoice.total_amount)}</span></div>
            </div>

            {/* Notes & Terms */}
            {detailInvoice.notes && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{detailInvoice.notes}</div>
              </div>
            )}
            {detailInvoice.terms && (
              <div className="invoice-terms-box" style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Terms & Conditions</div>
                <div>{detailInvoice.terms}</div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Create Invoice Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Invoice"
        wide
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>Create Invoice</button>
          </>
        }
      >
        {/* Invoice Details */}
        <div className="form-section-title" style={{ marginBottom: 16 }}>Invoice Details</div>
        <div className="form-grid" style={{ marginBottom: 24 }}>
          <div className="form-group">
            <label className="form-label">Client *</label>
            <select className="form-select" value={form.client_id} onChange={e => { setForm({ ...form, client_id: e.target.value, contact_id: '', opportunity_id: '' }); loadClientData(e.target.value); }}>
              <option value="">Select Client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.client_name} ({c.company_name})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Contact</label>
            <select className="form-select" value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })}>
              <option value="">Select Contact</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>
          <div className="form-group full-width">
            <label className="form-label">Subject</label>
            <input className="form-input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="e.g., Consulting Services - March 2026" />
          </div>
          <div className="form-group">
            <label className="form-label">Invoice Date</label>
            <input className="form-input" type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Terms</label>
            <select className="form-select" value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })}>
              {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Linked Opportunity</label>
            <select className="form-select" value={form.opportunity_id} onChange={e => setForm({ ...form, opportunity_id: e.target.value })}>
              <option value="">None</option>
              {opportunities.map(o => <option key={o.id} value={o.id}>{o.opportunity_name}</option>)}
            </select>
          </div>
        </div>

        {/* Line Items */}
        <div className="form-section-title" style={{ marginBottom: 16 }}>Line Items</div>
        <table className="line-items-table">
          <thead>
            <tr><th>Description</th><th style={{ width: 70 }}>Qty</th><th style={{ width: 100 }}>Unit</th><th style={{ width: 90 }}>Rate</th><th style={{ width: 60 }}>Disc%</th><th style={{ width: 100 }}>Amount</th><th style={{ width: 30 }}></th></tr>
          </thead>
          <tbody>
            {form.items.map((item, i) => {
              const lineAmt = (item.quantity || 0) * (item.rate || 0) * (1 - (item.discount_percent || 0) / 100);
              return (
                <tr key={i}>
                  <td><input className="form-input" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Service description" /></td>
                  <td><input className="form-input" type="number" min="0" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)} /></td>
                  <td><select className="form-select" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></td>
                  <td><input className="form-input" type="number" min="0" value={item.rate} onChange={e => updateItem(i, 'rate', parseFloat(e.target.value) || 0)} /></td>
                  <td><input className="form-input" type="number" min="0" max="100" value={item.discount_percent} onChange={e => updateItem(i, 'discount_percent', parseFloat(e.target.value) || 0)} /></td>
                  <td style={{ fontWeight: 500, padding: '6px 8px' }}>{fmt(lineAmt)}</td>
                  <td><button className="line-item-remove" onClick={() => removeItem(i)}><X size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button className="btn btn-secondary btn-sm" onClick={addItem} style={{ marginBottom: 24 }}><Plus size={14} /> Add Item</button>

        {/* Totals */}
        <div className="form-section-title" style={{ marginBottom: 16 }}>Totals</div>
        <div className="invoice-totals">
          <div className="invoice-totals-row"><span>Subtotal</span><span>{fmt(totals.subtotal)}</span></div>
          <div className="invoice-totals-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>Discount</span>
            <select className="form-select" style={{ width: 80, padding: '4px 6px', fontSize: 12 }} value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}>
              <option value="flat">Flat $</option>
              <option value="percent">%</option>
            </select>
            <input className="form-input" type="number" style={{ width: 80, padding: '4px 6px', fontSize: 12 }} value={form.discount_value} onChange={e => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })} />
            <span style={{ marginLeft: 'auto', color: 'var(--danger)' }}>-{fmt(totals.discountAmount)}</span>
          </div>
          <div className="invoice-totals-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>Tax Rate (%)</span>
            <input className="form-input" type="number" style={{ width: 60, padding: '4px 6px', fontSize: 12 }} value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })} />
            <span style={{ marginLeft: 'auto' }}>{fmt(totals.taxAmount)}</span>
          </div>
          <div className="invoice-totals-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>Shipping</span>
            <input className="form-input" type="number" style={{ width: 80, padding: '4px 6px', fontSize: 12, marginLeft: 'auto' }} value={form.shipping_charges} onChange={e => setForm({ ...form, shipping_charges: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="invoice-totals-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>Adjustment</span>
            <input className="form-input" type="number" style={{ width: 80, padding: '4px 6px', fontSize: 12, marginLeft: 'auto' }} value={form.adjustment} onChange={e => setForm({ ...form, adjustment: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="invoice-totals-row total"><span>Total</span><span>{fmt(totals.total)}</span></div>
        </div>

        {/* Notes & Terms */}
        <div className="form-section-title" style={{ marginTop: 24, marginBottom: 16 }}>Notes & Terms</div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any notes for the client..." /></div>
          <div className="form-group"><label className="form-label">Terms & Conditions</label><textarea className="form-textarea" value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} placeholder="Payment terms and conditions..." /></div>
        </div>
      </Modal>
    </div>
  );
}
