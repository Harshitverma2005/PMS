import { useEffect, useState } from 'react';
import {
  Flag, Shield, Search, User, Activity, AlertTriangle
} from 'lucide-react';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/auth';
import { adminService, feedbackService } from '../api';
import toast from 'react-hot-toast';

const COLORS = {
  bg: "#F5F4F0",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E4E2DC",
  accent: "#2563EB",
  accentDim: "#1D4ED8",
  emerald: "#059669",
  amber: "#D97706",
  rose: "#DC2626",
  violet: "#7C3AED",
  text: "#111111",
  muted: "#6B7280",
  subtle: "#9CA3AF",
};

// Defensively unwrap a list that may be an array, { data: [...] } or { items: [...] }.
function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export default function FeedbackFlags() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';

  const [flags, setFlags] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const loadFlags = async () => {
    setLoading(true);
    try {
      const [triage, statRes] = await Promise.all([
        adminService.getFlagsTriage(),
        adminService.getFlagsStats().catch(() => ({ data: null })),
      ]);
      setFlags(asList(triage?.data));
      setStats(statRes?.data || null);
    } catch (e) {
      toast.error('Unable to load risk flags');
    } finally {
      setLoading(false);
    }
  };

  // Mark a flag reviewed (resolved) on the backend; key off form_id.
  const handleReview = async (flag, action) => {
    const id = flag.form_id ?? flag.id;
    if (id == null) return;
    try {
      await feedbackService.reviewFlag(id, { notes: action === 'dismiss' ? 'Reviewed — no action' : 'Reviewed — intervention initiated' });
      toast.success(action === 'dismiss' ? 'Flag dismissed' : 'Intervention recorded');
      loadFlags();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Action failed');
    }
  };

  const SEVERITY = {
    1: { label: 'SOFT FLAG', color: '#F59E0B' },
    2: { label: 'RED FLAG', color: '#EF4444' },
    3: { label: 'CRITICAL · REPEAT', color: '#B91C1C' },
  };

  // Admin-only page.
  if (!isAdmin) {
    return (
      <Layout>
        <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <AlertTriangle size={40} color={COLORS.rose} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Access Restricted</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Strategic guardrails are reserved for administrators.</p>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.accent, animation: 'spin 1s linear infinite' }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page active" id="page-flags">

        {/* Header */}
        <div className="page-header flex justify-between items-center" style={{ marginBottom: '24px' }}>
          <div>
            <div className="page-title">Strategic Guardrails</div>
            <div className="page-desc">Auto-detected red flags from submitted review feedback</div>
          </div>
        </div>

        {/* System Health */}
        <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr", gap: '24px' }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: '24px' }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
               <div style={{ display: "flex", alignItems: "center", gap: '10px' }}>
                  <Flag size={18} color="#EF4444" />
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Active High-Risk Flags</span>
               </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: '12px' }}>
              {flags.map((flag, i) => {
                const employeeName = flag.employee_name || (flag.employee_id != null ? `Employee #${flag.employee_id}` : 'Unknown employee');
                const reason = flag.flag_reason || 'Anomaly detected.';
                const sev = SEVERITY[flag.severity] || SEVERITY[2];
                const ageLabel = flag.age_days === 0 ? 'Today' : `${flag.age_days}d ago`;
                return (
                <div key={flag.form_id ?? i} style={{
                  padding: "16px 20px", borderRadius: '12px', border: `1px solid ${sev.color}30`,
                  display: "flex", flexDirection: "column", gap: '12px',
                }}>
                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: '12px' }}>
                         <div style={{ width: '8px', height: '8px', borderRadius: "50%", background: sev.color, animation: "pulse 2s infinite" }} />
                         <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Review flag · {employeeName}</span>
                         <span style={{ fontSize: '11px', fontWeight: 700, padding: "2px 8px", borderRadius: '4px', background: `${sev.color}1a`, color: sev.color }}>{sev.label}</span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>{ageLabel}</span>
                   </div>
                   <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg)', padding: "10px 14px", borderRadius: '8px', borderLeft: `3px solid ${sev.color}` }}>
                      <b>Trigger:</b> {reason}
                   </div>
                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                       <div style={{ display: "flex", alignItems: "center", gap: '8px' }}>
                          <User size={14} color="var(--text-muted)" />
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{(flag.form_type || '').replace(/_/g, ' ')}</span>
                          {flag.rating != null && <><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>·</span><span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>rating {flag.rating}/5</span></>}
                       </div>
                      <div style={{ display: "flex", gap: '8px' }}>
                         <button onClick={() => handleReview(flag, 'dismiss')} className="btn btn-secondary btn-sm">Dismiss</button>
                         <button onClick={() => handleReview(flag, 'intervene')} className="btn btn-primary btn-sm">Intervene</button>
                      </div>
                   </div>
                </div>
                );
              })}
              {flags.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                   Strategic alignment stable. No risks detected in current execution.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: '24px' }}>
             {/* Flag statistics (live from the red-flag engine) */}
             <div className="card" style={{ display: "flex", flexDirection: "column", gap: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Flag Statistics</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: '12px' }}>
                  {[
                    { label: 'Open', value: stats?.open ?? 0, color: '#EF4444' },
                    { label: 'Critical', value: stats?.critical ?? 0, color: '#B91C1C' },
                    { label: 'Resolved', value: stats?.resolved ?? 0, color: '#10B981' },
                    { label: 'Total', value: stats?.total ?? 0, color: 'var(--text-muted)' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'var(--bg)', borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Auto-detected from submitted review feedback (low ratings, negative sentiment, repeat patterns).</div>
             </div>

             <div className="card" style={{ display: "flex", flexDirection: "column", gap: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', display: "flex", alignItems: "center", gap: '8px' }}>
                   <Activity size={16} color="var(--text-muted)" /> How flags work
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                   When a manager submits a review with a low rating (≤2), negative sentiment, or a blank assessment, the red-flag engine raises a flag here for admin intervention. Two consecutive flagged cycles escalate to critical.
                </div>
             </div>
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0% { transform: scale(0.95); opacity: 0.5; }
            50% { transform: scale(1); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.5; }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>

      </div>
    </Layout>
  );
}
