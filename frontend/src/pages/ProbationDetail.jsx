import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Clock, CheckCircle2, 
  AlertTriangle, MessageSquare, Send, Zap,
  TrendingUp, User, ShieldCheck, UserMinus,
  ChevronRight, MoreHorizontal, FileText
} from 'lucide-react';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/auth';
import { probationService, userService } from '../api';
import { formatDate } from '../utils/format';
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

const unwrap = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d[0] ?? null;
  if (Array.isArray(d?.data)) return d.data[0] ?? null;
  return d ?? null;
};

const normalizeRecord = (raw) => {
  if (!raw) return {};
  return {
    ...raw,
    employeeId: raw.employeeId ?? raw.employee_id,
    startDate: raw.startDate ?? raw.start_date,
    endDate: raw.endDate ?? raw.end_date,
  };
};

export default function ProbationDetail() {
  const { id: employeeId } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager';
  const allowed = isAdmin || isManager;

  const [employee, setEmployee] = useState(null);
  const [record, setRecord] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [recommendation, setRecommendation] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // Per-trigger manager check-in feedback
  const [checkInFor, setCheckInFor] = useState(null); // the trigger being filled
  const [ciRating, setCiRating] = useState(3);
  const [ciComment, setCiComment] = useState('');
  const [ciSubmitting, setCiSubmitting] = useState(false);

  const loadRecord = async () => {
    try {
      const recRes = await probationService.getByEmployee(employeeId);
      const rec = normalizeRecord(unwrap(recRes));
      setRecord(rec);
      setRecommendation(rec.recommendation || '');
      setNotes(rec.recommendation_notes || '');
    } catch {
      /* leave existing record in place */
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [empRes, recRes] = await Promise.allSettled([
          userService.getById(employeeId),
          probationService.getByEmployee(employeeId),
        ]);

        if (!active) return;

        const emp = empRes.status === 'fulfilled' ? (empRes.value?.data ?? null) : null;
        if (!emp) {
          setNotFound(true);
          toast.error('Employee not found');
          setLoading(false);
          return;
        }
        setEmployee(emp);

        const rec = recRes.status === 'fulfilled' ? normalizeRecord(unwrap(recRes.value)) : {};
        setRecord(rec);
        setRecommendation(rec.recommendation || '');
        setNotes(rec.recommendation_notes || '');
      } catch (err) {
        if (active) {
          setNotFound(true);
          toast.error('Failed to load probation record');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [employeeId]);

  const openCheckIn = (trigger) => {
    setCheckInFor(trigger);
    setCiRating(3);
    setCiComment('');
  };

  const submitCheckIn = async () => {
    if (!checkInFor?.id) return;
    if (!ciComment.trim()) return toast.error('Add a short assessment comment');
    setCiSubmitting(true);
    try {
      await probationService.submitTriggerFeedback(checkInFor.id, {
        feedback_type: 'manager',
        form_data: { rating: Number(ciRating), comment: ciComment.trim() },
      });
      toast.success('Check-in feedback submitted');
      setCheckInFor(null);
      await loadRecord();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to submit feedback');
    } finally {
      setCiSubmitting(false);
    }
  };

  const handleSubmitRecommendation = async (e) => {
    e.preventDefault();
    if (!recommendation) return toast.error('Please select a recommendation');
    if (!record?.id) return toast.error('No probation record available to update');

    setSubmitting(true);
    try {
      await probationService.recommend(record.id, {
        recommendation,
        recommendation_notes: notes,
        notes,
      });
      toast.success('Recommendation submitted');
      setRecord((r) => ({ ...r, recommendation, recommendation_notes: notes }));
    } catch (err) {
      toast.error('Failed to submit recommendation');
    } finally {
      setSubmitting(false);
    }
  };

  // Admin finalizes the probation based on the manager's recommendation.
  const finalize = async (action) => {
    if (!record?.id) return;
    const confirmMsg = action === 'complete'
      ? `Confirm ${employee?.name || 'this employee'} and end their probation? They will be moved off probation.`
      : `Terminate ${employee?.name || 'this employee'}'s probation? This marks it as rejected.`;
    if (!window.confirm(confirmMsg)) return;
    setFinalizing(true);
    try {
      if (action === 'complete') await probationService.complete(record.id);
      else await probationService.reject(record.id);
      toast.success(action === 'complete' ? 'Probation completed — employee confirmed' : 'Probation terminated');
      await loadRecord();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to finalize probation');
    } finally {
      setFinalizing(false);
    }
  };

  if (!allowed) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-500 mt-2">Probation records are visible to managers and admins only.</p>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading probation detail…
        </div>
      </Layout>
    );
  }

  if (notFound || !employee) {
    return (
      <Layout>
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Record not found</div>
          <button onClick={() => navigate('/probation')} className="btn btn-secondary btn-sm">Back to Tracker</button>
        </div>
      </Layout>
    );
  }


  const ps = (record.probation_status || '').toLowerCase();
  const isFinalized = ps === 'completed' || ps === 'rejected';
  const outcomeLabel = ps === 'completed'
    ? 'Probation Completed — Employee Confirmed'
    : ps === 'rejected' ? 'Probation Terminated' : '';
  const outcomeColor = ps === 'completed' ? '#059669' : '#DC2626';

  return (
    <Layout>
      <div className="page active" id="page-probation-detail">

        {/* Navigation & Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: '32px' }}>
          <button onClick={() => navigate('/probation')} className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: '8px', padding: '6px 12px' }}>
            <ArrowLeft size={16} /> Back to Tracker
          </button>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="badge" style={{ padding: '6px 14px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
              {record.calculated_status || record.probation_status || 'On Track'}
            </div>
          </div>
        </div>

        {/* Profile Summary Card */}
        <div className="card" style={{ padding: '32px', display: "flex", gap: '32px', marginBottom: '32px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'var(--bg)', display: "flex", alignItems: "center", justifyContent: "center", fontSize: '32px', fontWeight: 800, color: 'var(--text-muted)', border: '2px solid var(--border)' }}>
            {employee.name?.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text)', letterSpacing: "-0.04em" }}>{employee.name}</h1>
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '4px' }}>{employee.email} | Joined On: <b>{record.date_of_joining ? formatDate(record.date_of_joining) : 'Unknown'}</b></p>
            <div style={{ display: "flex", gap: '24px', marginTop: '20px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: "uppercase" }}>Working Days Elapsed</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', marginTop: '4px' }}>
                  {record.working_days_elapsed ?? 0}
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}> / ~90 Days</span>
                </div>
              </div>
              <div style={{ width: '1px', background: 'var(--border)' }} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: "uppercase" }}>Estimated Confirmation</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', marginTop: '4px' }}>{record.probation_end_date ? formatDate(record.probation_end_date) : '—'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Milestone Timeline */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: '32px' }}>
          <div style={{ display: "flex", flexDirection: "column", gap: '24px' }}>
            <div className="card" style={{ padding: '28px' }}>
              <div style={{ display: "flex", alignItems: "center", gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-light)', display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TrendingUp size={18} color="var(--primary)" />
                </div>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Milestone Roadmap</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {[30, 60, 80].map((day, idx) => {
                  const trigger = (record.triggers || []).find(t => t.trigger_day === day);
                  const feedbacks = trigger?.feedbacks || [];
                  const done = feedbacks.length > 0 || /submitted|complete/i.test(trigger?.status || '');
                  const fired = !!trigger;
                  const hasManagerFb = feedbacks.some(f => (f.feedback_type || '').toString().toLowerCase() === 'manager');
                  return (
                    <div key={day} style={{ display: "flex", gap: '20px' }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: "50%", background: done ? '#10B981' : fired ? '#F59E0B' : 'var(--bg)', border: `2px solid ${done ? '#10B981' : fired ? '#F59E0B' : 'var(--border)'}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                          {done && <CheckCircle2 size={14} color="#fff" />}
                        </div>
                        {idx !== 2 && <div style={{ flex: 1, width: '2px', background: 'var(--border)', margin: "4px 0" }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: '32px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Day {day} Check-in</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {done ? 'Feedback submitted' : fired ? `Awaiting feedback${trigger?.trigger_date ? ` · due ${formatDate(trigger.trigger_date)}` : ''}` : 'Upcoming'}
                        </div>
                        {feedbacks.map((fb, i) => (
                          <div key={i} style={{ marginTop: '12px', padding: '16px', background: 'var(--bg)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                              {(fb.feedback_type || '').toString().replace(/_/g, ' ')} feedback
                              {fb.form_data && typeof fb.form_data === 'object' && fb.form_data.rating != null ? ` · ${fb.form_data.rating}/5` : ''}
                              {fb.is_flagged ? ' · ⚠ flagged' : ''}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                              {typeof fb.form_data === 'object' ? (fb.form_data.comment || fb.form_data.summary || JSON.stringify(fb.form_data)) : String(fb.form_data)}
                            </div>
                          </div>
                        ))}
                        {fired && !hasManagerFb && (
                          <button
                            onClick={() => openCheckIn(trigger)}
                            className="btn btn-primary btn-sm"
                            style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <MessageSquare size={14} /> Submit check-in feedback
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(record.triggers || []).length === 0 && (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No check-ins have fired yet — the scheduler triggers them at 30, 60 and 80 working days.</div>
                )}
              </div>
            </div>
          </div>

          {/* Recommendation Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: '24px' }}>
            <div className="card" style={{ padding: '28px' }}>
              <div style={{ display: "flex", alignItems: "center", gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139,92,246,0.1)', display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldCheck size={18} color="#8B5CF6" />
                </div>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>{isAdmin && !isFinalized ? 'Probation Decision' : 'Manager Recommendation'}</span>
              </div>

              {isFinalized ? (
                /* Already decided — show the final outcome */
                <div style={{ padding: '16px', borderRadius: 12, background: `${outcomeColor}14`, border: `1px solid ${outcomeColor}40` }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: outcomeColor }}>{outcomeLabel}</div>
                  {record.recommendation && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Manager recommended: <b>{record.recommendation}</b></div>}
                  {record.recommendation_notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>"{record.recommendation_notes}"</div>}
                </div>
              ) : isAdmin ? (
                /* Admin acts on the manager's recommendation */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {record.recommendation ? (
                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Manager's Recommendation</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{record.recommendation}</div>
                      {record.recommendation_notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>"{record.recommendation_notes}"</div>}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '14px 16px', background: 'var(--bg)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                      The manager hasn't submitted a recommendation yet. You can still finalize directly.
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button onClick={() => finalize('complete')} disabled={finalizing} className="btn btn-primary"
                      style={{ width: '100%', background: '#059669', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: finalizing ? 0.7 : 1 }}>
                      <CheckCircle2 size={16} /> {finalizing ? 'Processing…' : 'Confirm & End Probation'}
                    </button>
                    <button onClick={() => finalize('reject')} disabled={finalizing} className="btn btn-secondary"
                      style={{ width: '100%', color: '#DC2626', borderColor: '#DC2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <UserMinus size={16} /> Terminate
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Confirming moves {employee?.name || 'the employee'} off probation (a confirmed employee) and freezes any pending milestone check-ins.
                  </div>
                </div>
              ) : (
                /* Manager submits / updates their recommendation */
                <form onSubmit={handleSubmitRecommendation} style={{ display: "flex", flexDirection: "column", gap: '20px' }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>RECOMMENDATION TO ADMIN</label>
                    <select
                      value={recommendation}
                      onChange={(e) => setRecommendation(e.target.value)}
                      style={{ padding: "12px", borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg)', outline: "none", fontSize: '14px', fontWeight: 600 }}
                      required
                    >
                      <option value="">Select an outcome...</option>
                      <option value="Confirm">Confirm as Employee</option>
                      <option value="Extend Probation">Extend Probation</option>
                      <option value="Terminate">Discontinue / Terminate</option>
                      <option value="Needs Improvement">Needs Improvement PIP</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>JUSTIFICATION NOTES</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Provide detailed rationale for your decision..."
                      style={{ padding: "12px", borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg)', outline: "none", fontSize: '14px', minHeight: '120px', resize: "none" }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      background: record.recommendation ? 'var(--text-muted)' : 'var(--primary)',
                      cursor: submitting ? "not-allowed" : "pointer",
                      boxShadow: record.recommendation ? "none" : '0 8px 20px rgba(37,99,235,0.2)',
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    {submitting ? 'Processing...' : record.recommendation ? 'Update Recommendation' : 'Send Recommendation to Admin'}
                  </button>
                  {record.recommendation && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                      Sent to admin: <b>{record.recommendation}</b>. Awaiting their final decision.
                    </div>
                  )}
                </form>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* Manager check-in feedback modal */}
      {checkInFor && (
        <div
          onClick={() => !ciSubmitting && setCheckInFor(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)' }}>
              Day {checkInFor.trigger_day} Check-in · {employee?.name}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '20px' }}>
              Your milestone assessment. A rating of 2 or below auto-flags this check-in for admin review.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>PERFORMANCE RATING</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCiRating(n)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: '10px', fontWeight: 800, fontSize: '15px', cursor: 'pointer',
                      border: `1px solid ${Number(ciRating) === n ? 'var(--primary)' : 'var(--border)'}`,
                      background: Number(ciRating) === n ? 'var(--primary)' : 'var(--bg)',
                      color: Number(ciRating) === n ? '#fff' : 'var(--text)',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>ASSESSMENT</label>
              <textarea
                value={ciComment}
                onChange={(e) => setCiComment(e.target.value)}
                placeholder="How is the employee progressing against expectations at this milestone?"
                style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg)', outline: 'none', fontSize: '14px', minHeight: '100px', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setCheckInFor(null)} disabled={ciSubmitting} className="btn btn-secondary btn-sm">Cancel</button>
              <button onClick={submitCheckIn} disabled={ciSubmitting} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Send size={14} /> {ciSubmitting ? 'Submitting…' : 'Submit feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
