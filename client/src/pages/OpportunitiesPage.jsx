// ============================================================
// OPPORTUNITIES PAGE — Sales pipeline management
// Features: Table view, Kanban pipeline view, detail modal,
//           inline stage editing, create/edit forms
// ============================================================

import { useState, useEffect } from 'react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, Eye, LayoutList, Kanban } from 'lucide-react';
import toast from 'react-hot-toast';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

const STAGES = ['prospecting', 'qualification', 'needs_analysis', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const STAGE_LABELS = { prospecting: 'Prospecting', qualification: 'Qualification', needs_analysis: 'Needs Analysis', proposal: 'Proposal', negotiation: 'Negotiation', closed_won: 'Closed Won', closed_lost: 'Closed Lost' };
const STAGE_PROB = { prospecting: 10, qualification: 20, needs_analysis: 40, proposal: 60, negotiation: 80, closed_won: 100, closed_lost: 0 };
const STAGE_COLORS = { prospecting: '#9ca3af', qualification: '#3b82f6', needs_analysis: '#8b5cf6', proposal: '#f59e0b', negotiation: '#ea580c', closed_won: '#16a34a', closed_lost: '#dc2626' };

export default function OpportunitiesPage() {
  const { isAdmin } = useAuth();
  const [opportunities, setOpportunities] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editOpp, setEditOpp] = useState(null);
  const [detailOpp, setDetailOpp] = useState(null);
  const [form, setForm] = useState({});

  const fetchData = () => {
    Promise.all([
      api.get('/opportunities'),
      api.get('/clients'),
      isAdmin ? api.get('/users') : Promise.resolve({ data: [] })
    ]).then(([oppRes, clientRes, userRes]) => {
      setOpportunities(oppRes.data);
      setClients(clientRes.data);
      setUsers(userRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(fetchData, [isAdmin]);

  // Load contacts when client changes in form
  const loadContacts = async (clientId) => {
    if (!clientId) { setContacts([]); return; }
    try {
      const res = await api.get(`/clients/${clientId}`);
      setContacts(res.data.contacts || []);
    } catch { setContacts([]); }
  };

  const openCreate = () => {
    setEditOpp(null);
    setContacts([]);
    setForm({ opportunity_name: '', client_id: '', contact_id: '', assigned_user_id: '', stage: 'prospecting', probability: 10, value: '', expected_close_date: '', lead_source: '', type: 'new_business', description: '', next_step: '' });
    setShowCreateModal(true);
  };

  const openEdit = (opp) => {
    setEditOpp(opp);
    loadContacts(opp.client_id);
    setForm({
      opportunity_name: opp.opportunity_name, client_id: opp.client_id, contact_id: opp.contact_id || '',
      assigned_user_id: opp.assigned_user_id || '', stage: opp.stage, probability: opp.probability,
      value: opp.value, expected_close_date: opp.expected_close_date || '',
      lead_source: opp.lead_source || '', type: opp.type || 'new_business',
      description: opp.description || '', next_step: opp.next_step || ''
    });
    setShowCreateModal(true);
  };

  const viewDetail = async (oppId) => {
    try {
      const res = await api.get(`/opportunities/${oppId}`);
      setDetailOpp(res.data);
      setShowDetailModal(true);
    } catch { toast.error('Failed to load details'); }
  };

  // Inline stage change (from table dropdown)
  const handleStageChange = async (opp, newStage) => {
    try {
      await api.put(`/opportunities/${opp.id}`, { stage: newStage });
      toast.success('Stage updated');
      fetchData();
    } catch { toast.error('Update failed'); }
  };

  const handleSubmit = async () => {
    try {
      if (editOpp) {
        await api.put(`/opportunities/${editOpp.id}`, form);
        toast.success('Opportunity updated');
      } else {
        await api.post('/opportunities', form);
        toast.success('Opportunity created');
      }
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (opp) => {
    if (!window.confirm(`Delete "${opp.opportunity_name}"?`)) return;
    try {
      await api.delete(`/opportunities/${opp.id}`);
      toast.success('Deleted');
      fetchData();
    } catch (err) { toast.error('Delete failed'); }
  };

  // Computed stats
  const openOpps = opportunities.filter(o => !['closed_won', 'closed_lost'].includes(o.stage));
  const wonOpps = opportunities.filter(o => o.stage === 'closed_won');
  const totalPipelineValue = openOpps.reduce((s, o) => s + (o.value || 0), 0);
  const wonValue = wonOpps.reduce((s, o) => s + (o.value || 0), 0);
  const winRate = opportunities.length > 0 ? Math.round((wonOpps.length / opportunities.length) * 100) : 0;

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Opportunities</h1>
        <div className="page-header-actions">
          <div className="view-toggle">
            <button className={`view-toggle-btn ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}><LayoutList size={14} /></button>
            <button className={`view-toggle-btn ${view === 'pipeline' ? 'active' : ''}`} onClick={() => setView('pipeline')}><Kanban size={14} /></button>
          </div>
          {isAdmin && <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Add Opportunity</button>}
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-card-label">Total Opportunities</div><div className="stat-card-value">{opportunities.length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Pipeline Value</div><div className="stat-card-value">{fmt(totalPipelineValue)}</div><div className="stat-card-trend">{openOpps.length} open deals</div></div>
        <div className="stat-card"><div className="stat-card-label">Won Value</div><div className="stat-card-value" style={{ color: 'var(--success)' }}>{fmt(wonValue)}</div></div>
        <div className="stat-card"><div className="stat-card-label">Win Rate</div><div className="stat-card-value">{winRate}%</div></div>
      </div>

      {/* Table View */}
      {view === 'table' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Opportunity</th><th>Client</th><th>Stage</th><th>Probability</th><th>Value</th><th>Weighted</th><th>Close Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {opportunities.map(opp => (
                <tr key={opp.id}>
                  <td className="table-clickable" onClick={() => viewDetail(opp.id)} style={{ fontWeight: 500 }}>{opp.opportunity_name}</td>
                  <td><div style={{ fontWeight: 500 }}>{opp.client_name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opp.company_name}</div></td>
                  <td>
                    {isAdmin ? (
                      <select className="inline-select" value={opp.stage} onChange={e => handleStageChange(opp, e.target.value)}>
                        {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                      </select>
                    ) : (
                      <span className={`badge badge-${opp.stage}`}>{STAGE_LABELS[opp.stage]}</span>
                    )}
                  </td>
                  <td>
                    <div className="progress-bar">
                      <div className="progress-track"><div className="progress-fill" style={{ width: `${opp.probability}%` }} /></div>
                      <span className="progress-label">{opp.probability}%</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{fmt(opp.value)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{fmt(opp.value * opp.probability / 100)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{opp.expected_close_date || '—'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-icon btn-ghost" onClick={() => viewDetail(opp.id)}><Eye size={14} /></button>
                      {isAdmin && <button className="btn-icon btn-ghost" onClick={() => openEdit(opp)}><Edit2 size={14} /></button>}
                      {isAdmin && <button className="btn-icon btn-ghost" onClick={() => handleDelete(opp)}><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {opportunities.length === 0 && <div className="table-empty">No opportunities found</div>}
        </div>
      )}

      {/* Pipeline / Kanban View */}
      {view === 'pipeline' && (
        <div className="pipeline-container">
          {STAGES.map(stage => {
            const stageOpps = opportunities.filter(o => o.stage === stage);
            const stageTotal = stageOpps.reduce((s, o) => s + (o.value || 0), 0);
            return (
              <div key={stage} className="pipeline-column">
                <div className="pipeline-column-header" style={{ borderTopColor: STAGE_COLORS[stage] }}>
                  <div className="pipeline-column-title">{STAGE_LABELS[stage]}</div>
                  <div className="pipeline-column-count">{stageOpps.length} deals</div>
                </div>
                <div className="pipeline-cards">
                  {stageOpps.map(opp => (
                    <div key={opp.id} className="pipeline-card" onClick={() => viewDetail(opp.id)}>
                      <div className="pipeline-card-title">{opp.opportunity_name}</div>
                      <div className="pipeline-card-client">{opp.client_name} · {opp.company_name}</div>
                      <div className="pipeline-card-footer">
                        <span className="pipeline-card-value">{fmt(opp.value)}</span>
                        <span className="pipeline-card-prob">{opp.probability}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pipeline-column-footer">Total: {fmt(stageTotal)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={detailOpp?.opportunity_name || ''}
        footer={
          <>
            {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => { setShowDetailModal(false); handleDelete(detailOpp); }}>Delete</button>}
            {isAdmin && <button className="btn btn-secondary" onClick={() => { setShowDetailModal(false); openEdit(detailOpp); }}>Edit</button>}
            <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Close</button>
          </>
        }
      >
        {detailOpp && (
          <>
            {/* Stage progress bar */}
            <div className="stage-progress">
              {STAGES.slice(0, 6).map((s, i) => {
                const currentIndex = STAGES.indexOf(detailOpp.stage);
                const isLost = detailOpp.stage === 'closed_lost';
                return <div key={s} className={`stage-progress-segment ${isLost ? 'lost' : (i <= currentIndex ? 'filled' : '')}`} />;
              })}
            </div>

            <div className="detail-grid">
              <div className="detail-item"><span className="detail-label">Value</span><span className="detail-value" style={{ fontSize: 20, fontWeight: 700 }}>{fmt(detailOpp.value)}</span></div>
              <div className="detail-item"><span className="detail-label">Probability</span><span className="detail-value" style={{ fontSize: 20, fontWeight: 700 }}>{detailOpp.probability}%</span></div>
              <div className="detail-item"><span className="detail-label">Weighted Value</span><span className="detail-value">{fmt(detailOpp.value * detailOpp.probability / 100)}</span></div>
              <div className="detail-item"><span className="detail-label">Close Date</span><span className="detail-value">{detailOpp.expected_close_date || '—'}</span></div>
              <div className="detail-item"><span className="detail-label">Client</span><span className="detail-value">{detailOpp.client_name} ({detailOpp.company_name})</span></div>
              <div className="detail-item"><span className="detail-label">Stage</span><span className="detail-value"><span className={`badge badge-${detailOpp.stage}`}>{STAGE_LABELS[detailOpp.stage]}</span></span></div>
              <div className="detail-item"><span className="detail-label">Lead Source</span><span className="detail-value" style={{ textTransform: 'capitalize' }}>{detailOpp.lead_source || '—'}</span></div>
              <div className="detail-item"><span className="detail-label">Type</span><span className="detail-value" style={{ textTransform: 'capitalize' }}>{(detailOpp.type || '').replace('_', ' ')}</span></div>
              <div className="detail-item"><span className="detail-label">Owner</span><span className="detail-value">{detailOpp.assigned_user_name || '—'}</span></div>
              <div className="detail-item"><span className="detail-label">Contact</span><span className="detail-value">{detailOpp.contact_name || '—'}</span></div>
              {detailOpp.description && <div className="detail-description">{detailOpp.description}</div>}
              {detailOpp.next_step && (
                <div className="next-step-box">
                  <div className="next-step-label">Next Step</div>
                  <div className="next-step-text">{detailOpp.next_step}</div>
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editOpp ? 'Edit Opportunity' : 'Create Opportunity'}
        wide
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editOpp ? 'Update' : 'Create'}</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group full-width"><label className="form-label">Opportunity Name *</label><input className="form-input" value={form.opportunity_name || ''} onChange={e => setForm({ ...form, opportunity_name: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Client *</label>
            <select className="form-select" value={form.client_id || ''} onChange={e => { setForm({ ...form, client_id: e.target.value, contact_id: '' }); loadContacts(e.target.value); }}>
              <option value="">Select Client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.client_name} ({c.company_name})</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Contact</label>
            <select className="form-select" value={form.contact_id || ''} onChange={e => setForm({ ...form, contact_id: e.target.value })}>
              <option value="">Select Contact</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Stage</label>
            <select className="form-select" value={form.stage || 'prospecting'} onChange={e => setForm({ ...form, stage: e.target.value, probability: STAGE_PROB[e.target.value] })}>
              {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]} ({STAGE_PROB[s]}%)</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Probability (%)</label><input className="form-input" type="number" min="0" max="100" value={form.probability || ''} onChange={e => setForm({ ...form, probability: parseInt(e.target.value) })} /></div>
          <div className="form-group"><label className="form-label">Deal Value ($)</label><input className="form-input" type="number" value={form.value || ''} onChange={e => setForm({ ...form, value: parseFloat(e.target.value) })} /></div>
          <div className="form-group"><label className="form-label">Expected Close Date</label><input className="form-input" type="date" value={form.expected_close_date || ''} onChange={e => setForm({ ...form, expected_close_date: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Lead Source</label>
            <select className="form-select" value={form.lead_source || ''} onChange={e => setForm({ ...form, lead_source: e.target.value })}>
              <option value="">Select Source</option>
              {['direct', 'website', 'referral', 'trade_show', 'cold_call', 'social_media', 'partner'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Type</label>
            <select className="form-select" value={form.type || 'new_business'} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="new_business">New Business</option><option value="existing_business">Existing Business</option><option value="renewal">Renewal</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">Assigned To</label>
            <select className="form-select" value={form.assigned_user_id || ''} onChange={e => setForm({ ...form, assigned_user_id: e.target.value })}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="form-group full-width"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="form-group full-width"><label className="form-label">Next Step</label><input className="form-input" value={form.next_step || ''} onChange={e => setForm({ ...form, next_step: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}
