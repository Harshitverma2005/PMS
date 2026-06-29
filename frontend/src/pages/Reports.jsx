import { useEffect, useState } from 'react';
import { FileText, Target, Shield, Activity, AlertTriangle } from 'lucide-react';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/auth';
import { adminService, userService } from '../api';
import toast from 'react-hot-toast';

function unwrapList(res) {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.items)) return d.items;
  return [];
}

export default function Reports() {
  const currentUser = useAuthStore((s) => s.user) || {};
  const [dashboard, setDashboard] = useState(null);
  const [goals, setGoals] = useState([]);
  const [probation, setProbation] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [dash, goalsRes, probRes, revRes, usersRes] = await Promise.all([
          adminService.getDashboard().catch(() => ({ data: null })),
          adminService.getReportsGoals().catch(() => ({ data: { data: [] } })),
          adminService.getReportsProbation().catch(() => ({ data: [] })),
          adminService.getReportsReviews().catch(() => ({ data: [] })),
          userService.getAll().catch(() => ({ data: [] })),
        ]);
        setDashboard(dash.data);
        setGoals(unwrapList(goalsRes));
        setProbation(unwrapList(probRes));
        setReviews(unwrapList(revRes));
        setUsers(unwrapList(usersRes));
      } catch (err) {
        toast.error('Failed to load reports');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const nameFor = (id) => users.find(u => u.id === id)?.name || `#${id}`;

  const kpis = [
    { label: "Total Goals", value: dashboard?.total_goals ?? goals.length, icon: Target, color: 'var(--primary)' },
    { label: "Active Goals", value: dashboard?.active_goals ?? goals.filter(g => g.status === 'active').length, icon: Activity, color: '#10B981' },
    { label: "At Risk Goals", value: dashboard?.at_risk_goals ?? goals.filter(g => g.is_at_risk).length, icon: AlertTriangle, color: '#EF4444' },
    { label: "Probation In Progress", value: dashboard?.probation_in_progress ?? probation.length, icon: Shield, color: '#F59E0B' },
  ];

  return (
    <Layout>
      <div className="page active" id="page-reports">
        <div className="page-header flex justify-between items-center" style={{ marginBottom: '24px' }}>
          <div>
            <div className="page-title">Reports & Analytics</div>
            <div className="page-desc">Organisation-wide performance analytics and audit trails</div>
          </div>
        </div>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: '20px', marginBottom: '24px' }}>
          {kpis.map((stat, i) => (
            <div key={i} className="card" style={{ padding: '20px' }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${stat.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <stat.icon size={18} color={stat.color} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{stat.value}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Goals Report */}
        <div className="card" style={{ padding: '0', overflow: "hidden", marginBottom: '24px' }}>
          <div style={{ padding: "20px 24px", borderBottom: '1px solid var(--border)', display: "flex", alignItems: "center", gap: '10px' }}>
            <Target size={18} color="var(--primary)" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Goals Report</span>
            <span style={{ marginLeft: "auto", fontSize: '12px', color: 'var(--text-muted)' }}>{goals.length} total</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {["Title", "Assignee", "Status", "Priority", "Completion", "At Risk"].map(h => (
                  <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {goals.slice(0, 12).map(g => (
                <tr key={g.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: "14px 20px", fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{g.title}</td>
                  <td style={{ padding: "14px 20px", fontSize: '12px', color: 'var(--text-muted)' }}>{nameFor(g.assignee_id)}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <span className="badge" style={{ background: g.status === 'active' ? 'rgba(16,185,129,0.1)' : 'var(--bg)', color: g.status === 'active' ? '#10B981' : 'var(--text-muted)', textTransform: "capitalize" }}>{(g.status || '').replace('_', ' ')}</span>
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: '12px', color: 'var(--text-muted)', textTransform: "capitalize" }}>{g.priority || '—'}</td>
                  <td style={{ padding: "14px 20px", fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>{Math.round(g.completion_pct ?? g.completion_percentage ?? 0)}%</td>
                  <td style={{ padding: "14px 20px" }}>
                    {g.is_at_risk ? <span style={{ color: '#EF4444', fontSize: '11px', fontWeight: 700 }}>⚠ AT RISK</span> : <span style={{ color: '#10B981', fontSize: '11px', fontWeight: 700 }}>✓ OK</span>}
                  </td>
                </tr>
              ))}
              {!loading && goals.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '32px', textAlign: "center", color: 'var(--text-muted)' }}>No goals to report.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Probation & Reviews side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: '24px' }}>
          <div className="card" style={{ padding: '0', overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: '1px solid var(--border)', display: "flex", alignItems: "center", gap: '10px' }}>
              <Shield size={18} color="#F59E0B" />
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Probation Report</span>
              <span style={{ marginLeft: "auto", fontSize: '12px', color: 'var(--text-muted)' }}>{probation.length} records</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {probation.map((p, i) => (
                <div key={p.id || i} style={{ padding: "14px 20px", borderTop: '1px solid var(--border)', display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{p.employee_name || nameFor(p.employee_id)}</div>
                  <span className="badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', textTransform: "capitalize" }}>{(p.status || 'active').replace('_', ' ')}</span>
                </div>
              ))}
              {probation.length === 0 && <div style={{ padding: '32px', textAlign: "center", color: 'var(--text-muted)' }}>No probation records</div>}
            </div>
          </div>

          <div className="card" style={{ padding: '0', overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: '1px solid var(--border)', display: "flex", alignItems: "center", gap: '10px' }}>
              <FileText size={18} color="#8B5CF6" />
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Review Cycles Report</span>
              <span style={{ marginLeft: "auto", fontSize: '12px', color: 'var(--text-muted)' }}>{reviews.length} entries</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {reviews.map((r, i) => (
                <div key={r.id || i} style={{ padding: "14px 20px", borderTop: '1px solid var(--border)', display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{r.name || r.cycle_name || r.title || `Cycle #${r.id}`}</div>
                  <span className="badge" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{r.status || (r.is_active ? 'active' : 'closed')}</span>
                </div>
              ))}
              {reviews.length === 0 && <div style={{ padding: '32px', textAlign: "center", color: 'var(--text-muted)' }}>No review cycles</div>}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
