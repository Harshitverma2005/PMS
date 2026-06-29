import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCheck, Clock, AlertTriangle,
  Search, ArrowUpRight, RefreshCw, ShieldCheck, Plus, Zap
} from 'lucide-react';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/auth';
import { probationService, userService } from '../api';
import { formatDate } from '../utils/format';
import toast from 'react-hot-toast';

const COLORS = {
  bg: "#F5F4F0", surface: "#FFFFFF", card: "#FFFFFF", border: "#E4E2DC",
  accent: "#2563EB", emerald: "#059669", amber: "#D97706", rose: "#DC2626",
  violet: "#7C3AED", text: "#111111", muted: "#6B7280", subtle: "#9CA3AF",
};

const asArray = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.items)) return d.items;
  return [];
};

const statusColor = (status) => {
  const s = (status || '').toLowerCase();
  if (s.includes('on track') || s.includes('completed')) return COLORS.emerald;
  if (s.includes('overdue') || s.includes('terminated')) return COLORS.rose;
  if (s.includes('pending') || s.includes('due') || s.includes('review')) return COLORS.amber;
  if (s.includes('paused')) return COLORS.muted;
  return COLORS.accent;
};

export default function Probation() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const isAllowed = isAdmin || currentUser?.role === 'manager';

  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [probations, setProbations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [probRes, userRes] = await Promise.all([
        probationService.getAll(),
        userService.getAll().catch(() => ({ data: [] })),
      ]);
      const userList = asArray(userRes);
      setAllUsers(userList);
      const userMap = Object.fromEntries(userList.map(u => [u.id, u]));

      let probList = asArray(probRes).map(p => ({
        ...p,
        emp: p.employee || userMap[p.employee_id] || null,
      }));
      if (currentUser?.role === 'manager') {
        probList = probList.filter(p => (p.emp?.manager_id ?? userMap[p.employee_id]?.manager_id) === currentUser.id);
      }
      setProbations(probList);
    } catch (err) {
      toast.error('Failed to load probation records');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (isAllowed) load();
    else setLoading(false);
  }, [isAllowed, load]);

  const handleScan = async () => {
    setScanning(true);
    try {
      await probationService.scan();
      toast.success('Milestones scanned — due check-ins fired');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  if (!isAllowed) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <ShieldCheck size={48} className="text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-500 mt-2">You do not have permission to view the Probation Tracker.</p>
        </div>
      </Layout>
    );
  }

  const filtered = probations.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (p.emp?.name || '').toLowerCase().includes(term) || (p.calculated_status || '').toLowerCase().includes(term);
  });

  // Milestone (trigger) status for a given day (30/60/80).
  const milestone = (prob, day) => {
    const t = (prob.triggers || []).find(tr => tr.trigger_day === day);
    if (!t) return { color: 'var(--bg)', label: 'Upcoming', text: 'var(--text-muted)' };
    const st = (t.status || '').toLowerCase();
    if (st === 'submitted' || (t.feedbacks || []).length > 0) return { color: '#10B981', label: 'Submitted', text: '#10B981' };
    if (st === 'escalated') return { color: '#EF4444', label: 'Escalated', text: '#EF4444' };
    if (st === 'blocked') return { color: '#EF4444', label: 'Blocked', text: '#EF4444' };
    return { color: '#F59E0B', label: 'Awaiting', text: '#F59E0B' }; // triggered
  };

  // Map exactly to the backend's calculated_status / probation_status values.
  const cs = (p) => p.calculated_status || 'On Track';
  const ps = (p) => (p.probation_status || '').toLowerCase();
  const inProbation = probations.filter(p => ['in_probation', 'paused'].includes(ps(p))).length;
  const overdue = probations.filter(p => cs(p) === 'Overdue').length;
  const pending = probations.filter(p => ['Pending Form', 'Final Review Due'].includes(cs(p))).length;
  const completed = probations.filter(p => ps(p) === 'completed').length;

  return (
    <Layout>
      <div className="page active" id="page-probation">
        <div className="page-header flex justify-between items-center" style={{ marginBottom: '24px' }}>
          <div>
            <div className="page-title">Probation Milestone Tracker</div>
            <div className="page-desc">Onboarding oversight — 30/60/80-day check-ins fire automatically</div>
          </div>
          {isAdmin && (
            <div style={{ display: "flex", gap: '10px' }}>
              <button onClick={handleScan} disabled={scanning} className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: '8px', opacity: scanning ? 0.6 : 1 }}>
                <Zap size={16} color="#F59E0B" /> {scanning ? 'Scanning…' : 'Scan Milestones'}
              </button>
              <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: '8px' }}>
                <Plus size={16} /> Start Probation
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: '24px', marginBottom: '32px' }}>
          {[
            { label: "In Probation", value: inProbation, icon: UserCheck, color: 'var(--primary)' },
            { label: "Overdue", value: overdue, icon: AlertTriangle, color: '#EF4444' },
            { label: "Action Pending", value: pending, icon: Clock, color: '#F59E0B' },
            { label: "Confirmed", value: completed, icon: ShieldCheck, color: '#10B981' },
          ].map((stat, i) => (
            <div key={i} className="card" style={{ padding: "20px", display: "flex", alignItems: "center", gap: '16px', flexDirection: 'row' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${stat.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <stat.icon size={20} color={stat.color} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: "uppercase" }}>{stat.label}</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)' }}>{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: "16px 20px", borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: "relative", width: '320px' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: '14px', top: "50%", transform: "translateY(-50%)" }} />
              <input type="text" placeholder="Search by employee or status..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: "100%", padding: "10px 14px 10px 40px", borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '13px', outline: "none" }} />
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {["Employee", "Joined", "Days Elapsed", "Day 30", "Day 60", "Day 80", "Status", "Ends", ""].map((h, i) => (
                    <th key={i} style={{ textAlign: "left", padding: "14px 20px", fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: "uppercase", borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((prob) => (
                  <tr key={prob.id}>
                    <td style={{ padding: "16px 20px", borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: "flex", alignItems: "center", gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)', display: "flex", alignItems: "center", justifyContent: "center", fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {prob.emp?.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{prob.emp?.name || `Employee #${prob.employee_id}`}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{prob.emp?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", borderBottom: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-muted)' }}>{formatDate(prob.date_of_joining)}</td>
                    <td style={{ padding: "16px 20px", borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{prob.working_days_elapsed ?? '—'}</td>
                    {[30, 60, 80].map(day => {
                      const m = milestone(prob, day);
                      return (
                        <td key={day} style={{ padding: "16px 20px", borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: '4px' }}>
                            <div style={{ height: '6px', width: '40px', background: m.color, borderRadius: '3px' }} />
                            <div style={{ fontSize: '10px', fontWeight: 700, color: m.text }}>{m.label}</div>
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ padding: "16px 20px", borderBottom: '1px solid var(--border)' }}>
                      <div className="badge" style={{ background: `${statusColor(prob.calculated_status)}15`, color: statusColor(prob.calculated_status) }}>
                        {prob.calculated_status || 'On Track'}
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(prob.probation_end_date)}</td>
                    <td style={{ padding: "16px 20px", borderBottom: '1px solid var(--border)' }}>
                      <button onClick={() => navigate(`/probation/${prob.employee_id}`)} className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: '6px' }}>
                        Open <ArrowUpRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loading && (
            <div style={{ padding: "64px 0", textAlign: "center", color: 'var(--text-muted)' }}>
              <RefreshCw size={32} style={{ opacity: 0.4, marginBottom: '12px', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading probation records…</div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: "64px 0", textAlign: "center", color: 'var(--text-muted)' }}>
              <UserCheck size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <div style={{ fontSize: '16px', fontWeight: 700 }}>No one in probation</div>
              <div style={{ fontSize: '13px' }}>{isAdmin ? 'Start a probation to begin tracking onboarding milestones.' : 'None of your reports are in probation.'}</div>
            </div>
          )}
        </div>

        {showModal && (
          <ProbationModal
            users={allUsers}
            existing={probations.map(p => p.employee_id)}
            onClose={() => setShowModal(false)}
            onSuccess={() => { setShowModal(false); load(); }}
          />
        )}
      </div>
    </Layout>
  );
}

function ProbationModal({ users, existing, onClose, onSuccess }) {
  const today = new Date().toISOString().slice(0, 10);
  const eligible = (users || []).filter(u => u.role === 'member' && !existing.includes(u.id));
  const [employeeId, setEmployeeId] = useState(eligible[0]?.id ? String(eligible[0].id) : '');
  const [doj, setDoj] = useState(() => {
    const u = eligible[0];
    return (u?.date_of_joining || today).slice(0, 10);
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId) { toast.error('Select an employee'); return; }
    setSubmitting(true);
    try {
      await probationService.create({ employee_id: Number(employeeId), date_of_joining: doj });
      toast.success('Probation started');
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to start probation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: COLORS.surface, borderRadius: 20, padding: 32, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 20, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>Start Probation</h3>
          <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>30/60/80-day check-ins fire automatically based on the join date.</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>Employee</label>
            <select value={employeeId} onChange={(e) => {
              setEmployeeId(e.target.value);
              const u = eligible.find(x => String(x.id) === e.target.value);
              if (u?.date_of_joining) setDoj(u.date_of_joining.slice(0, 10));
            }} style={{ padding: "10px 14px", border: `1.5px solid ${COLORS.border}`, borderRadius: 10, fontSize: 13, background: "#fff" }}>
              {eligible.length === 0 && <option value="">No eligible employees</option>}
              {eligible.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>Date of Joining</label>
            <input type="date" value={doj} onChange={(e) => setDoj(e.target.value)} required
              style={{ padding: "10px 14px", border: `1.5px solid ${COLORS.border}`, borderRadius: 10, fontSize: 13 }} />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 11, border: `1.5px solid ${COLORS.border}`, background: "#fff", color: COLORS.muted, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={submitting || eligible.length === 0} style={{ flex: 2, padding: "12px", borderRadius: 11, border: "none", background: COLORS.accent, color: "#fff", fontWeight: 700, cursor: "pointer", opacity: (submitting || eligible.length === 0) ? 0.6 : 1 }}>
              {submitting ? 'Starting…' : 'Start Probation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
