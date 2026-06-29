import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Calendar, Users, Clock, Zap, AlertTriangle, Star, Shield, X, Download
} from 'lucide-react';
import Layout from '../components/Layout';
import { formatDate } from '../utils/format';
import { useAuthStore } from '../store/auth';
import { cycleService, feedbackService, userService, exportApiService } from '../api';
import toast from 'react-hot-toast';

const COLORS = {
  bg: "#F5F4F0", surface: "#FFFFFF", card: "#FFFFFF", border: "#E4E2DC",
  accent: "#2563EB", accentDim: "#1D4ED8", emerald: "#059669",
  amber: "#D97706", rose: "#DC2626", violet: "#7C3AED",
  text: "#111111", muted: "#6B7280", subtle: "#9CA3AF",
};

function unwrapList(res) {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
}

export default function Cycles() {
  const currentUser = useAuthStore((s) => s.user);
  const [cycles, setCycles] = useState([]);
  const [progress, setProgress] = useState({}); // cycleId -> { submitted, total }
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [upwardCycle, setUpwardCycle] = useState(null); // cycle whose upward feedback admin is viewing
  const [resultsCycle, setResultsCycle] = useState(null); // cycle whose per-employee results admin is viewing

  const isAdmin = currentUser?.role === 'admin';

  const fetchCycles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cycleService.getAll();
      const list = unwrapList(res);
      setCycles(list);

      // Member-scoped self-review progress:
      //   admin   -> all members (via the cycle compliance endpoint)
      //   manager -> only their direct reports (computed from their forms)
      const map = {};
      if (currentUser?.role === 'admin') {
        const entries = await Promise.all(list.map(c =>
          cycleService.getCompliance(c.id)
            .then(r => [c.id, { submitted: r.data?.self_submitted ?? 0, total: r.data?.total_employees ?? 0 }])
            .catch(() => [c.id, { submitted: 0, total: 0 }])
        ));
        entries.forEach(([id, v]) => { map[id] = v; });
      } else {
        const [formsRes, usersRes] = await Promise.all([
          feedbackService.getMyForms().catch(() => ({ data: [] })),
          userService.getAll().catch(() => ({ data: [] })),
        ]);
        const forms = unwrapList(formsRes);
        const reportIds = new Set(unwrapList(usersRes).filter(u => u.manager_id === currentUser.id).map(u => u.id));
        list.forEach(c => {
          const teamSelf = forms.filter(f => f.review_cycle_id === c.id && f.form_type === 'self_assessment' && reportIds.has(f.employee_id));
          map[c.id] = { total: teamSelf.length, submitted: teamSelf.filter(f => f.status === 'submitted').length };
        });
      }
      setProgress(map);
    } catch (err) {
      toast.error('Failed to load review cycles');
      setCycles([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'manager') {
      fetchCycles();
    } else {
      setLoading(false);
    }
  }, [currentUser, fetchCycles]);

  const handleClose = async (id) => {
    if (!confirm('Close this review cycle? Unsubmitted forms will be waived.')) return;
    try {
      await cycleService.close(id);
      toast.success('Cycle closed');
      fetchCycles();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to close cycle');
    }
  };

  const handleTrigger = async (id) => {
    if (!confirm('Activate this cycle? This generates self & manager review forms for all eligible employees.')) return;
    try {
      await cycleService.trigger(id);
      toast.success('Cycle activated — review forms generated');
      fetchCycles();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to activate cycle');
    }
  };

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
    return (
      <Layout>
        <div style={{ height: "60vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <AlertTriangle size={40} color={COLORS.rose} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>Access Restricted</h2>
          <p style={{ fontSize: 14, color: COLORS.muted }}>Review cycle management is reserved for administrative personnel.</p>
        </div>
      </Layout>
    );
  }

  const isCycleActive = (c) => c.status ? c.status === 'active' : !!c.is_active;
  const activeCount = cycles.filter(isCycleActive).length;
  const closedCount = cycles.length - activeCount;

  return (
    <Layout>
      <div className="page active" id="page-cycles">

        <div className="page-header flex justify-between items-center" style={{ marginBottom: '24px' }}>
          <div>
            <div className="page-title">Review Cycles</div>
            <div className="page-desc">Manage performance evaluation windows and review schedules</div>
          </div>
          {isAdmin && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <Plus size={16} style={{marginRight: '8px'}} /> Create Cycle
            </button>
          )}
        </div>

        {/* Summary bar */}
        <div style={{ display: "flex", gap: '16px', padding: "16px", background: 'var(--primary-light)', borderRadius: '12px', border: '1px dashed rgba(37,99,235,0.4)', marginBottom: '24px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary)', display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={16} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>Cycle Overview</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              <b>{activeCount} active</b> · <b>{closedCount} closed</b> · <b>{cycles.length} total</b>
            </div>
          </div>
        </div>

        {/* Cycle List */}
        <div style={{ display: "flex", flexDirection: "column", gap: '20px' }}>
          {cycles.map((cycle) => {
            const active = isCycleActive(cycle);
            const statusColor = active ? '#10B981' : 'var(--text-muted)';
            const startDate = cycle.start_date || cycle.period_start;
            const endDate = cycle.end_date || cycle.period_end;
            const cycleName = cycle.cycle_name || cycle.name;
            const cycleTrack = cycle.cycle_type || cycle.track;
            const prog = progress[cycle.id] || { submitted: 0, total: 0 };
            const pct = prog.total ? Math.round((prog.submitted / prog.total) * 100) : 0;
            return (
              <div key={cycle.id} className="card" style={{ padding: '24px', position: "relative" }}>
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: '4px', background: statusColor, borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: '8px' }}>
                    <div style={{ display: "flex", alignItems: "center", gap: '12px' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>{cycleName}</h2>
                      <div className="badge" style={{ background: `${statusColor}15`, color: statusColor }}>{cycle.status || (active ? 'active' : 'closed')}</div>
                      {cycleTrack && <div className="badge">{cycleTrack?.replace('_', ' ')}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: '20px', flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <Calendar size={13} /> {formatDate(startDate)} — {formatDate(endDate)}
                      </div>
                      {cycleTrack && (
                        <div style={{ display: "flex", alignItems: "center", gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          <Clock size={13} /> Review track: <b>{cycleTrack}</b>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: '10px' }}>
                    {isAdmin && cycle.status !== 'pending' && (
                      <button onClick={() => setResultsCycle(cycle)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={13} color="#2563EB" /> Review Results
                      </button>
                    )}
                    {isAdmin && cycle.status !== 'pending' && (
                      <button onClick={() => setUpwardCycle(cycle)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Star size={13} color="#7C3AED" /> Upward Feedback
                      </button>
                    )}
                    {isAdmin && cycle.status === 'pending' && (
                      <button onClick={() => handleTrigger(cycle.id)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '12px', background: '#10B981', color: '#fff' }}>Activate Cycle</button>
                    )}
                    {isAdmin && active && (
                      <button onClick={() => handleClose(cycle.id)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '12px', background: '#EF4444', color: '#fff' }}>Close Cycle</button>
                    )}
                  </div>
                </div>

                {/* Self-review progress, scoped to the viewer's members
                    (manager → their team; admin → all members). */}
                {prog.total > 0 && (
                  <div style={{ marginTop: '16px', display: "flex", flexDirection: "column", gap: '6px' }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: '11px', fontWeight: 700 }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {isAdmin ? 'SELF-REVIEWS IN' : 'TEAM SELF-REVIEWS IN'} · {prog.submitted}/{prog.total} member{prog.total === 1 ? '' : 's'}
                      </span>
                      <span style={{ color: 'var(--text)' }}>{pct}%</span>
                    </div>
                    <div className="progress-bar-wrap">
                      <div className="progress-bar" style={{ width: `${pct}%`, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {!loading && cycles.length === 0 && (
            <div style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '64px', textAlign: "center", color: 'var(--text-muted)' }}>
              No review cycles found. {isAdmin ? 'Create one to get started.' : 'Check back later.'}
            </div>
          )}
          {loading && (
            <div style={{ padding: '64px', textAlign: "center", color: 'var(--text-muted)' }}>
              Loading review cycles…
            </div>
          )}
        </div>

        {showModal && (
          <CycleModal
            onClose={() => setShowModal(false)}
            onSuccess={() => { setShowModal(false); fetchCycles(); }}
          />
        )}

        {upwardCycle && (
          <UpwardFeedbackModal
            cycle={upwardCycle}
            onClose={() => setUpwardCycle(null)}
          />
        )}

        {resultsCycle && (
          <ResultsModal
            cycle={resultsCycle}
            onClose={() => setResultsCycle(null)}
          />
        )}
      </div>
    </Layout>
  );
}

function ResultsModal({ cycle, onClose }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let active = true;
    cycleService.getResults(cycle.id)
      .then(r => { if (active) setRows(Array.isArray(r.data) ? r.data : []); })
      .catch(() => { if (active) setRows([]); });
    return () => { active = false; };
  }, [cycle.id]);

  const ratingColor = (n) => n == null ? COLORS.subtle : n >= 4 ? COLORS.emerald : n === 3 ? COLORS.amber : COLORS.rose;
  const pill = (label, color) => (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: `${color}1a`, color, textTransform: "uppercase" }}>{label}</span>
  );

  const submittedCount = (rows || []).filter(r => r.manager_submitted).length;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.surface, borderRadius: 20, padding: 28, width: "100%", maxWidth: 720, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-light)', display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={20} color="#2563EB" />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>Review Results</h3>
              <p style={{ fontSize: 12, color: COLORS.muted }}>{cycle.cycle_name || cycle.name} · {submittedCount}/{(rows || []).length} manager reviews submitted</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><X size={20} /></button>
        </div>

        {rows === null && <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>Loading…</div>}
        {rows !== null && rows.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, border: `2px dashed ${COLORS.border}`, borderRadius: 12 }}>
            No review forms for this cycle yet.
          </div>
        )}

        {rows !== null && rows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map(r => (
              <div key={r.employee_id} style={{ border: `1px solid ${r.is_flagged ? COLORS.rose : COLORS.border}`, borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{r.employee_name || `Employee #${r.employee_id}`}</div>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>Manager: {r.manager_name || '—'}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {r.is_flagged ? pill('flagged', COLORS.rose) : null}
                    {r.cross_shared ? pill('shared', COLORS.emerald) : pill('in progress', COLORS.amber)}
                    <span style={{ fontSize: 18, fontWeight: 800, color: ratingColor(r.manager_rating), minWidth: 44, textAlign: "right" }}>
                      {r.manager_rating != null ? `${r.manager_rating}/5` : '—'}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, fontWeight: 700, color: COLORS.muted, alignItems: "center" }}>
                  <span>Self: <span style={{ color: r.self_submitted ? COLORS.emerald : COLORS.amber }}>{r.self_submitted ? 'submitted' : r.self_status}</span></span>
                  <span>Manager: <span style={{ color: r.manager_submitted ? COLORS.emerald : COLORS.amber }}>{r.manager_submitted ? 'submitted' : r.manager_status}</span></span>
                  {r.manager_submitted && r.manager_form_id && (
                    <button
                      onClick={() => exportApiService.exportReview(r.manager_form_id).catch(e => toast.error(e?.message || 'Export failed'))}
                      style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: COLORS.accent, cursor: "pointer" }}
                    >
                      <Download size={12} /> Download Report
                    </button>
                  )}
                </div>
                {r.manager_feedback && (
                  <p style={{ fontSize: 12, color: COLORS.muted, marginTop: 8, lineHeight: 1.5, borderLeft: `3px solid ${COLORS.border}`, paddingLeft: 10 }}>{r.manager_feedback}</p>
                )}
                {r.is_flagged && r.flag_reason && (
                  <p style={{ fontSize: 11, color: COLORS.rose, marginTop: 6, fontWeight: 600 }}>⚠ {r.flag_reason}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UpwardFeedbackModal({ cycle, onClose }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let active = true;
    cycleService.getUpwardFeedback(cycle.id)
      .then(r => { if (active) setRows(Array.isArray(r.data) ? r.data : []); })
      .catch(() => { if (active) setRows([]); });
    return () => { active = false; };
  }, [cycle.id]);

  // Group by manager
  const byManager = {};
  (rows || []).forEach(r => {
    const key = r.manager_name || `Manager #${r.manager_id}`;
    (byManager[key] = byManager[key] || []).push(r);
  });

  const ratingColor = (n) => n == null ? COLORS.subtle : n >= 4 ? COLORS.emerald : n === 3 ? COLORS.amber : COLORS.rose;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.surface, borderRadius: 20, padding: 28, width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(124,58,237,0.1)', display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Star size={20} color="#7C3AED" />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>Upward Feedback</h3>
              <p style={{ fontSize: 12, color: COLORS.muted }}>{cycle.cycle_name || cycle.name} · employees rating their managers</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}><X size={20} /></button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 10, padding: "10px 14px", margin: "12px 0 20px" }}>
          <Shield size={14} color="#7C3AED" />
          <span style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600 }}>Admin-only. Managers cannot see this feedback or who submitted it.</span>
        </div>

        {rows === null && <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>Loading…</div>}
        {rows !== null && rows.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, border: `2px dashed ${COLORS.border}`, borderRadius: 12 }}>
            No upward feedback forms for this cycle.
          </div>
        )}

        {rows !== null && Object.entries(byManager).map(([mgr, items]) => {
          const rated = items.filter(i => i.final_rating != null);
          const avg = rated.length ? (rated.reduce((a, b) => a + b.final_rating, 0) / rated.length).toFixed(1) : null;
          return (
            <div key={mgr} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{mgr}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted }}>
                    {avg != null ? <>avg <span style={{ color: ratingColor(Math.round(avg)) }}>{avg}/5</span> · </> : ''}
                    {rated.length}/{items.length} submitted
                  </div>
                  {items[0]?.manager_id != null && (
                    <button
                      onClick={() => exportApiService.exportUpwardReport(cycle.id, items[0].manager_id).catch(e => toast.error(e?.message || 'Export failed'))}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: '#7C3AED', cursor: "pointer" }}
                    >
                      <Download size={12} /> Download
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map(r => (
                  <div key={r.form_id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{r.rater_name || `Employee #${r.rater_id}`}</span>
                      {r.status === 'submitted' ? (
                        <span style={{ fontSize: 13, fontWeight: 800, color: ratingColor(r.final_rating) }}>{r.final_rating}/5</span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.amber, textTransform: "uppercase" }}>{r.status}</span>
                      )}
                    </div>
                    {r.form_data?.comments && (
                      <p style={{ fontSize: 12, color: COLORS.muted, marginTop: 6, lineHeight: 1.5 }}>{r.form_data.comments}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CycleModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '', track: 'quarterly',
    start_date: '', end_date: '',
    self_review_deadline: '', manager_review_deadline: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await cycleService.create({
        cycle_name: formData.name,
        cycle_type: formData.track,
        start_date: formData.start_date,
        end_date: formData.end_date,
        self_review_deadline: formData.self_review_deadline,
        manager_review_deadline: formData.manager_review_deadline,
      });
      toast.success('Review cycle created');
      onSuccess();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to create review cycle');
    } finally {
      setSubmitting(false);
    }
  };

  const field = (label, key, type = "text", opts = {}) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>{label}</label>
      <input type={type} value={formData[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
        style={{ padding: "10px 14px", border: `1.5px solid ${COLORS.border}`, borderRadius: 10, fontSize: 13, outline: "none" }}
        required {...opts} />
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: COLORS.surface, borderRadius: 20, padding: 32, width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>Create Review Cycle</h3>
          <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>Define a new performance evaluation window</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {field("Cycle Name", "name", "text", { placeholder: "e.g. Q2 2026 Performance Review" })}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>Cycle Track</label>
            <select value={formData.track} onChange={(e) => setFormData({ ...formData, track: e.target.value })}
              style={{ padding: "10px 14px", border: `1.5px solid ${COLORS.border}`, borderRadius: 10, fontSize: 13, outline: "none", background: "#fff" }}>
              <option value="quarterly">Quarterly</option>
              <option value="bi_annual">Bi-Annual</option>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {field("Start Date", "start_date", "date")}
            {field("End Date", "end_date", "date")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {field("Self Review Deadline", "self_review_deadline", "date")}
            {field("Manager Review Deadline", "manager_review_deadline", "date")}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 11, border: `1.5px solid ${COLORS.border}`, background: "#fff", color: COLORS.muted, fontWeight: 700, cursor: "pointer" }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={{ flex: 2, padding: "12px", borderRadius: 11, border: "none", background: COLORS.accent, color: "#fff", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Creating…' : 'Create Cycle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
