// ============================================================
// DASHBOARD PAGE — Homepage after login
// Admin: full stats, pipeline chart, recent tables
// Client: simple 4-card summary
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { DollarSign, Building2, Target, AlertTriangle, TrendingUp } from 'lucide-react';

// Helper: format currency
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

// Stage colors for the pipeline bar
const STAGE_COLORS = {
  prospecting: '#9ca3af',
  qualification: '#3b82f6',
  needs_analysis: '#8b5cf6',
  proposal: '#f59e0b',
  negotiation: '#ea580c',
  closed_won: '#16a34a',
  closed_lost: '#dc2626'
};

const STAGE_LABELS = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  needs_analysis: 'Needs Analysis',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost'
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/dashboard')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <div className="loading-spinner"><div className="spinner"></div></div>;
  }

  // ---- CLIENT/EMPLOYEE DASHBOARD ----
  if (!isAdmin) {
    return (
      <div>
        <div className="page-header">
          <h1>Dashboard</h1>
        </div>
        <div className="stats-grid">
          <div className="stat-card" onClick={() => navigate('/clients')}>
            <div className="stat-card-header">
              <span className="stat-card-label">My Clients</span>
              <Building2 size={18} color="var(--text-muted)" />
            </div>
            <div className="stat-card-value">{data.totalClients}</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/opportunities')}>
            <div className="stat-card-header">
              <span className="stat-card-label">Opportunities</span>
              <Target size={18} color="var(--text-muted)" />
            </div>
            <div className="stat-card-value">{data.totalOpportunities}</div>
            <div className="stat-card-trend">{fmt(data.pipelineValue)} pipeline</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/invoices')}>
            <div className="stat-card-header">
              <span className="stat-card-label">Invoices</span>
              <DollarSign size={18} color="var(--text-muted)" />
            </div>
            <div className="stat-card-value">{data.totalInvoices}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Revenue</span>
              <TrendingUp size={18} color="var(--text-muted)" />
            </div>
            <div className="stat-card-value">{fmt(data.totalRevenue)}</div>
          </div>
        </div>
      </div>
    );
  }

  // ---- ADMIN DASHBOARD ----
  const totalPipeline = (data.opportunityStages || []).reduce((s, v) => s + v.total_value, 0);

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/invoices')}>
          <div className="stat-card-header">
            <span className="stat-card-label">Revenue (Paid)</span>
            <span className="badge badge-success">Collected</span>
          </div>
          <div className="stat-card-value">{fmt(data.totalRevenue)}</div>
          <div className="stat-card-trend">{fmt(data.pendingRevenue)} pending</div>
          <div className="stat-card-subtitle">{data.paidCount} paid invoices</div>
        </div>

        <div className="stat-card" onClick={() => navigate('/clients')}>
          <div className="stat-card-header">
            <span className="stat-card-label">Clients</span>
            <span className="badge badge-success">{data.activeClients} Active</span>
          </div>
          <div className="stat-card-value">{data.totalClients}</div>
          <div className="stat-card-trend">{data.totalContacts} contacts</div>
          <div className="stat-card-subtitle">active accounts</div>
        </div>

        <div className="stat-card" onClick={() => navigate('/opportunities')}>
          <div className="stat-card-header">
            <span className="stat-card-label">Pipeline Value</span>
            <span className="badge badge-info">Open</span>
          </div>
          <div className="stat-card-value">{fmt(data.pipelineValue)}</div>
          <div className="stat-card-trend">{fmt(data.weightedPipeline)} weighted</div>
          <div className="stat-card-subtitle">{data.openCount} open / {data.wonCount} won</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Overdue</span>
            <span className={`badge ${data.overdueRevenue > 0 ? 'badge-danger' : 'badge-success'}`}>
              {data.overdueRevenue > 0 ? 'Attention' : 'Clear'}
            </span>
          </div>
          <div className="stat-card-value">{fmt(data.overdueRevenue)}</div>
          <div className="stat-card-trend">{data.overdueCount || 0} overdue invoices</div>
        </div>
      </div>

      {/* Sales Pipeline Bar */}
      {data.opportunityStages && data.opportunityStages.length > 0 && (
        <div className="pipeline-bar-container">
          <div className="pipeline-bar-title">Sales Pipeline Distribution</div>
          <div className="pipeline-bar">
            {data.opportunityStages.map((stage) => (
              <div
                key={stage.stage}
                className="pipeline-bar-segment"
                style={{
                  width: `${totalPipeline > 0 ? (stage.total_value / totalPipeline * 100) : 0}%`,
                  backgroundColor: STAGE_COLORS[stage.stage]
                }}
                title={`${STAGE_LABELS[stage.stage]}: ${fmt(stage.total_value)}`}
              />
            ))}
          </div>
          <div className="pipeline-legend">
            {data.opportunityStages.map((stage) => (
              <div key={stage.stage} className="pipeline-legend-item">
                <div className="pipeline-legend-dot" style={{ backgroundColor: STAGE_COLORS[stage.stage] }} />
                <span>{STAGE_LABELS[stage.stage]} ({stage.count}) — {fmt(stage.total_value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-column: Recent Opportunities + Recent Invoices */}
      <div className="two-column-grid">
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">Recent Opportunities</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Client</th>
                <th>Stage</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {(data.recentOpportunities || []).map((opp) => (
                <tr key={opp.id}>
                  <td className="table-clickable" onClick={() => navigate('/opportunities')}>{opp.opportunity_name}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{opp.client_name}</td>
                  <td><span className={`badge badge-${opp.stage}`}>{STAGE_LABELS[opp.stage]}</span></td>
                  <td>{fmt(opp.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">Recent Invoices</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(data.recentInvoices || []).map((inv) => (
                <tr key={inv.id}>
                  <td className="table-clickable" onClick={() => navigate('/invoices')}>{inv.invoice_number}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{inv.client_name}</td>
                  <td>
                    <span className={`badge ${inv.status === 'paid' ? 'badge-success' : inv.status === 'overdue' ? 'badge-danger' : inv.status === 'sent' ? 'badge-info' : 'badge-neutral'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td>{fmt(inv.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Clients */}
      {data.topClients && data.topClients.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">Top Clients by Revenue</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Company</th>
                <th>Invoices</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.topClients.map((client) => (
                <tr key={client.id}>
                  <td style={{ fontWeight: 500 }}>{client.client_name}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{client.company_name}</td>
                  <td>{client.invoice_count}</td>
                  <td style={{ fontWeight: 600, color: 'var(--success)' }}>{fmt(client.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
