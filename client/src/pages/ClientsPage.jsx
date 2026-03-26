// ============================================================
// CLIENTS PAGE — Zoho-quality client management
// Features: list table, detail modal with tabs, create/edit forms
// ============================================================

import { useState, useEffect } from 'react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, Eye, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

const STAGE_LABELS = {
  prospecting: 'Prospecting', qualification: 'Qualification', needs_analysis: 'Needs Analysis',
  proposal: 'Proposal', negotiation: 'Negotiation', closed_won: 'Closed Won', closed_lost: 'Closed Lost'
};

const INDUSTRIES = ['Technology', 'IT Services', 'Consulting', 'Healthcare', 'Manufacturing', 'Finance', 'Education', 'Retail', 'Other'];
const SOURCES = ['direct', 'website', 'referral', 'trade_show', 'cold_call', 'social_media', 'partner', 'other'];

export default function ClientsPage() {
  const { isAdmin } = useAuth();
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [detailClient, setDetailClient] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [form, setForm] = useState({});
  const [contactForm, setContactForm] = useState({ first_name: '', last_name: '', email: '', phone: '', designation: '', department: '', is_primary: false });

  const fetchClients = () => {
    api.get('/clients').then(res => setClients(res.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClients();
    if (isAdmin) api.get('/users').then(res => setUsers(res.data)).catch(() => {});
  }, [isAdmin]);

  // View client detail (with tabs)
  const viewDetail = async (clientId) => {
    try {
      const res = await api.get(`/clients/${clientId}`);
      setDetailClient(res.data);
      setActiveTab('overview');
      setShowDetailModal(true);
    } catch {
      toast.error('Failed to load client details');
    }
  };

  // Open create/edit modal
  const openCreate = () => {
    setEditClient(null);
    setForm({ client_name: '', email: '', phone: '', company_name: '', industry: '', website: '', annual_revenue: '', source: 'direct', status: 'active', description: '', assigned_user_id: '', billing_street: '', billing_city: '', billing_state: '', billing_zip: '', billing_country: '' });
    setShowCreateModal(true);
  };

  const openEdit = (client) => {
    setEditClient(client);
    setForm({
      client_name: client.client_name, email: client.email || '', phone: client.phone || '', company_name: client.company_name || '',
      industry: client.industry || '', website: client.website || '', annual_revenue: client.annual_revenue || '',
      source: client.source || 'direct', status: client.status || 'active', description: client.description || '',
      assigned_user_id: client.assigned_user_id || '',
      billing_street: client.billing_street || '', billing_city: client.billing_city || '',
      billing_state: client.billing_state || '', billing_zip: client.billing_zip || '', billing_country: client.billing_country || ''
    });
    setShowCreateModal(true);
  };

  // Submit create/edit
  const handleSubmit = async () => {
    try {
      if (editClient) {
        await api.put(`/clients/${editClient.id}`, form);
        toast.success('Client updated');
      } else {
        await api.post('/clients', form);
        toast.success('Client created');
      }
      setShowCreateModal(false);
      fetchClients();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed');
    }
  };

  // Delete client
  const handleDelete = async (client) => {
    if (!window.confirm(`Delete "${client.client_name}"? All related data will be deleted.`)) return;
    try {
      await api.delete(`/clients/${client.id}`);
      toast.success('Client deleted');
      fetchClients();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  // Add contact
  const handleAddContact = async () => {
    try {
      await api.post(`/clients/${detailClient.id}/contacts`, contactForm);
      toast.success('Contact added');
      setShowContactModal(false);
      viewDetail(detailClient.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add contact');
    }
  };

  // Delete contact
  const handleDeleteContact = async (contactId) => {
    if (!window.confirm('Delete this contact?')) return;
    try {
      await api.delete(`/clients/${detailClient.id}/contacts/${contactId}`);
      toast.success('Contact deleted');
      viewDetail(detailClient.id);
    } catch (err) {
      toast.error('Failed to delete contact');
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Clients</h1>
        {isAdmin && (
          <div className="page-header-actions">
            <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Add Client</button>
          </div>
        )}
      </div>

      {/* Client List Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Industry</th>
              <th>Contacts</th>
              <th>Opportunities</th>
              <th>Revenue</th>
              <th>Status</th>
              <th>Source</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
                      {c.client_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <div className="table-clickable" onClick={() => viewDetail(c.id)} style={{ fontWeight: 500 }}>{c.client_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.company_name}</div>
                    </div>
                  </div>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.industry || '—'}</td>
                <td>{c.contact_count}</td>
                <td>{c.opportunity_count}</td>
                <td style={{ fontWeight: 500, color: 'var(--success)' }}>{fmt(c.total_revenue)}</td>
                <td><span className={`badge ${c.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{c.status}</span></td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'capitalize' }}>{c.source}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn-icon btn-ghost" onClick={() => viewDetail(c.id)} title="View"><Eye size={14} /></button>
                    {isAdmin && <button className="btn-icon btn-ghost" onClick={() => openEdit(c)} title="Edit"><Edit2 size={14} /></button>}
                    {isAdmin && <button className="btn-icon btn-ghost" onClick={() => handleDelete(c)} title="Delete"><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && <div className="table-empty">No clients found</div>}
      </div>

      {/* Client Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={detailClient ? `${detailClient.client_name}` : ''}
        wide
        footer={
          <>
            {isAdmin && <button className="btn btn-secondary" onClick={() => { setShowDetailModal(false); openEdit(detailClient); }}>Edit Client</button>}
            <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Close</button>
          </>
        }
      >
        {detailClient && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{detailClient.company_name}</span>
              <span className={`badge ${detailClient.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{detailClient.status}</span>
            </div>

            {/* Tabs */}
            <div className="tabs">
              {['overview', 'contacts', 'opportunities', 'invoices'].map(tab => (
                <div key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </div>
              ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                <div className="detail-grid">
                  <div className="detail-item"><span className="detail-label">Email</span><span className="detail-value">{detailClient.email || '—'}</span></div>
                  <div className="detail-item"><span className="detail-label">Phone</span><span className="detail-value">{detailClient.phone || '—'}</span></div>
                  <div className="detail-item"><span className="detail-label">Website</span><span className="detail-value">{detailClient.website ? <a href={detailClient.website} target="_blank" rel="noreferrer">{detailClient.website}</a> : '—'}</span></div>
                  <div className="detail-item"><span className="detail-label">Industry</span><span className="detail-value">{detailClient.industry || '—'}</span></div>
                  <div className="detail-item"><span className="detail-label">Annual Revenue</span><span className="detail-value">{fmt(detailClient.annual_revenue)}</span></div>
                  <div className="detail-item"><span className="detail-label">Source</span><span className="detail-value" style={{ textTransform: 'capitalize' }}>{detailClient.source}</span></div>
                  {detailClient.billing_city && (
                    <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                      <span className="detail-label">Billing Address</span>
                      <span className="detail-value">{[detailClient.billing_street, detailClient.billing_city, detailClient.billing_state, detailClient.billing_zip, detailClient.billing_country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {detailClient.description && <div className="detail-description">{detailClient.description}</div>}
                </div>
                <div className="mini-stats">
                  <div className="mini-stat"><div className="mini-stat-value">{detailClient.contacts?.length || 0}</div><div className="mini-stat-label">Contacts</div></div>
                  <div className="mini-stat"><div className="mini-stat-value">{detailClient.opportunities?.length || 0}</div><div className="mini-stat-label">Opportunities</div></div>
                  <div className="mini-stat"><div className="mini-stat-value">{detailClient.invoices?.length || 0}</div><div className="mini-stat-label">Invoices</div></div>
                </div>
              </>
            )}

            {/* Contacts Tab */}
            {activeTab === 'contacts' && (
              <>
                {isAdmin && (
                  <div style={{ marginBottom: 12 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setContactForm({ first_name: '', last_name: '', email: '', phone: '', designation: '', department: '', is_primary: false }); setShowContactModal(true); }}>
                      <UserPlus size={14} /> Add Contact
                    </button>
                  </div>
                )}
                <table className="table">
                  <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Designation</th><th>Department</th>{isAdmin && <th></th>}</tr></thead>
                  <tbody>
                    {(detailClient.contacts || []).map(ct => (
                      <tr key={ct.id}>
                        <td style={{ fontWeight: 500 }}>
                          {ct.first_name} {ct.last_name}
                          {ct.is_primary ? <span className="badge badge-info" style={{ marginLeft: 6 }}>Primary</span> : ''}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{ct.email || '—'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{ct.phone || '—'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{ct.designation || '—'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{ct.department || '—'}</td>
                        {isAdmin && <td><button className="btn-icon btn-ghost" onClick={() => handleDeleteContact(ct.id)}><Trash2 size={14} /></button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!detailClient.contacts || detailClient.contacts.length === 0) && <div className="table-empty">No contacts yet</div>}
              </>
            )}

            {/* Opportunities Tab */}
            {activeTab === 'opportunities' && (
              <table className="table">
                <thead><tr><th>Opportunity</th><th>Stage</th><th>Probability</th><th>Value</th><th>Close Date</th></tr></thead>
                <tbody>
                  {(detailClient.opportunities || []).map(opp => (
                    <tr key={opp.id}>
                      <td style={{ fontWeight: 500 }}>{opp.opportunity_name}</td>
                      <td><span className={`badge badge-${opp.stage}`}>{STAGE_LABELS[opp.stage]}</span></td>
                      <td>{opp.probability}%</td>
                      <td style={{ fontWeight: 500 }}>{fmt(opp.value)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{opp.expected_close_date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Invoices Tab */}
            {activeTab === 'invoices' && (
              <table className="table">
                <thead><tr><th>Invoice #</th><th>Subject</th><th>Status</th><th>Amount</th><th>Due Date</th></tr></thead>
                <tbody>
                  {(detailClient.invoices || []).map(inv => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 500 }}>{inv.invoice_number}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{inv.subject || '—'}</td>
                      <td><span className={`badge ${inv.status === 'paid' ? 'badge-success' : inv.status === 'overdue' ? 'badge-danger' : inv.status === 'sent' ? 'badge-info' : 'badge-neutral'}`}>{inv.status}</span></td>
                      <td style={{ fontWeight: 500 }}>{fmt(inv.total_amount)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{inv.due_date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </Modal>

      {/* Create/Edit Client Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editClient ? 'Edit Client' : 'Create Client'}
        wide
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editClient ? 'Update' : 'Create'}</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-section-title">Basic Information</div>
          <div className="form-group"><label className="form-label">Client Name *</label><input className="form-input" value={form.client_name || ''} onChange={e => setForm({ ...form, client_name: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Company Name</label><input className="form-input" value={form.company_name || ''} onChange={e => setForm({ ...form, company_name: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Industry</label>
            <select className="form-select" value={form.industry || ''} onChange={e => setForm({ ...form, industry: e.target.value })}>
              <option value="">Select Industry</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Website</label><input className="form-input" value={form.website || ''} onChange={e => setForm({ ...form, website: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Annual Revenue</label><input className="form-input" type="number" value={form.annual_revenue || ''} onChange={e => setForm({ ...form, annual_revenue: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Source</label>
            <select className="form-select" value={form.source || 'direct'} onChange={e => setForm({ ...form, source: e.target.value })}>
              {SOURCES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Status</label>
            <select className="form-select" value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">Assigned To</label>
            <select className="form-select" value={form.assigned_user_id || ''} onChange={e => setForm({ ...form, assigned_user_id: e.target.value })}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="form-group full-width"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>

          <div className="form-section-title">Billing Address</div>
          <div className="form-group full-width"><label className="form-label">Street</label><input className="form-input" value={form.billing_street || ''} onChange={e => setForm({ ...form, billing_street: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">City</label><input className="form-input" value={form.billing_city || ''} onChange={e => setForm({ ...form, billing_city: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">State</label><input className="form-input" value={form.billing_state || ''} onChange={e => setForm({ ...form, billing_state: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Zip Code</label><input className="form-input" value={form.billing_zip || ''} onChange={e => setForm({ ...form, billing_zip: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Country</label><input className="form-input" value={form.billing_country || ''} onChange={e => setForm({ ...form, billing_country: e.target.value })} /></div>
        </div>
      </Modal>

      {/* Add Contact Modal */}
      <Modal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        title="Add Contact"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowContactModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddContact}>Add Contact</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group"><label className="form-label">First Name *</label><input className="form-input" value={contactForm.first_name} onChange={e => setContactForm({ ...contactForm, first_name: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Last Name *</label><input className="form-input" value={contactForm.last_name} onChange={e => setContactForm({ ...contactForm, last_name: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Designation</label><input className="form-input" value={contactForm.designation} onChange={e => setContactForm({ ...contactForm, designation: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Department</label><input className="form-input" value={contactForm.department} onChange={e => setContactForm({ ...contactForm, department: e.target.value })} /></div>
          <div className="form-group full-width">
            <label className="form-checkbox"><input type="checkbox" checked={contactForm.is_primary} onChange={e => setContactForm({ ...contactForm, is_primary: e.target.checked })} /> Primary Contact</label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
