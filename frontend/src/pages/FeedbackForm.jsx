import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Star, Save, ClipboardCheck, User, 
  Shield, AlertTriangle, ChevronLeft, Zap,
  Activity, Award, Target, MessageSquare
} from 'lucide-react';
import Layout from '../components/Layout';
import { feedbackService } from '../api';
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
  if (d && Array.isArray(d.data)) return d.data[0] ?? null;
  if (d && d.data && !Array.isArray(d.data)) return d.data;
  return d ?? null;
};

export default function FeedbackForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  const [responses, setResponses] = useState({});
  const [rating, setRating] = useState('meets');       // manager_feedback: below/meets/above
  const [overallRating, setOverallRating] = useState(0); // upward_feedback: 1–5
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await feedbackService.getById(id);
        const data = unwrap(res);
        if (!active) return;
        if (!data) {
          toast.error('Feedback form not found');
          navigate('/performance');
          return;
        }
        setForm(data);
        setEmployee(data.employee ?? null);
        setResponses(data.form_data || {});
        setRating(data.rating || 'meets');
        setOverallRating(data.final_rating || 0);
      } catch (err) {
        if (active) {
          toast.error('Feedback form not found');
          navigate('/performance');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, navigate]);

  const handleResponseChange = (question, value) => {
    setResponses({ ...responses, [question]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isUpwardForm = form?.form_type === 'upward_feedback';
    const isMgrForm = form?.form_type === 'manager_feedback';

    // Upward feedback uses a direct 1–5 rating; require a selection.
    if (isUpwardForm && !(overallRating >= 1 && overallRating <= 5)) {
      return toast.error('Please give your manager an overall rating (1–5)');
    }

    setSubmitting(true);
    try {
      const ratingMap = { below_expectations: 2, meets: 3, above_expectations: 4 };
      const body = { form_data: responses };
      if (isUpwardForm) body.final_rating = Number(overallRating);
      else if (isMgrForm) body.final_rating = ratingMap[rating] || 3;
      await feedbackService.submitForm(id, body);
      toast.success('Review submitted');
      navigate('/performance');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to submit review');
      setSubmitting(false);
    }
  };

  const calculateScore = (res) => {
    const scores = Object.values(res).filter(v => typeof v === 'number');
    if (scores.length === 0) return 0;
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  };


  const isUpward = form?.form_type === 'upward_feedback';
  const isManagerForm = form?.form_type === 'manager_feedback';
  const isSelf = form?.form_type === 'self_assessment';
  const needsRating = isManagerForm || isUpward;
  const isSubmitted = form?.status === 'submitted';
  const managerName = form?.manager_of_record_name || form?.manager?.name;

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading feedback form…
        </div>
      </Layout>
    );
  }

  if (!form) return null;

  return (
    <Layout>
      <div className="page active" id="page-feedback-form">
        
        {/* Header Section */}
        <div className="page-header flex justify-between items-center" style={{ marginBottom: '24px' }}>
           <div style={{ display: "flex", alignItems: "center", gap: '20px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: isSelf ? 'var(--primary-light)' : isUpward ? 'rgba(124,58,237,0.1)' : 'rgba(16,185,129,0.1)',
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isSelf ? <User size={28} color="var(--primary)" /> : isUpward ? <Star size={28} color="#7C3AED" /> : <Shield size={28} color="#10B981" />}
              </div>
              <div>
                <div className="page-title">
                   {isSelf ? 'Self-Review Reflection' : isUpward ? `Upward Feedback${managerName ? `: ${managerName}` : ' — Rate Your Manager'}` : `Evaluating: ${employee?.name}`}
                </div>
                <div className="page-desc">{form.cycle?.name || 'Performance Review'}</div>
              </div>
           </div>
           {isSubmitted && (
              <div className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardCheck size={16} /> RECORD FINALIZED
              </div>
           )}
        </div>

        {/* Anonymity Alert — manager review of an employee */}
        {form.status === 'pending' && isManagerForm && (
          <div style={{
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '12px', padding: "16px 20px", display: "flex", gap: '12px', alignItems: "flex-start",
            marginBottom: '24px'
          }}>
             <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
             <p style={{ fontSize: '13px', color: '#F59E0B', fontWeight: 600, lineHeight: 1.5 }}>
                <b>Anonymity Protocol:</b> Your feedback will remain restricted from the member until they have also submitted their self-review form for this cycle.
             </p>
          </div>
        )}

        {/* Confidentiality note — upward feedback (admin-only) */}
        {form.status !== 'submitted' && isUpward && (
          <div style={{
            background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: '12px', padding: "16px 20px", display: "flex", gap: '12px', alignItems: "flex-start",
            marginBottom: '24px'
          }}>
             <Shield size={18} color="#7C3AED" style={{ flexShrink: 0, marginTop: '2px' }} />
             <p style={{ fontSize: '13px', color: '#7C3AED', fontWeight: 600, lineHeight: 1.5 }}>
                <b>Confidential:</b> This feedback about your manager is shared with administrators only. Your manager will not see it or know how you rated them.
             </p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: '24px', paddingBottom: '100px' }}>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: '24px' }}>
            <Section title={isUpward ? 'Leadership & Direction' : 'Competency & Results'} icon={Activity}>
              <RatingQuestion label={isUpward ? 'Clarity of Direction' : 'Quality of Deliverables'} name="quality_deliverables" value={responses.quality_deliverables} onChange={handleResponseChange} disabled={isSubmitted} />
              <RatingQuestion label={isUpward ? 'Decision-Making' : 'Task Execution Velocity'} name="timeliness" value={responses.timeliness} onChange={handleResponseChange} disabled={isSubmitted} />
              <RatingQuestion label={isUpward ? 'Removes Blockers' : 'Innovation & Solving'} name="innovation" value={responses.innovation} onChange={handleResponseChange} disabled={isSubmitted} />
            </Section>

            <Section title={isUpward ? 'Support & Fairness' : 'Collaboration & Impact'} icon={Target}>
              <RatingQuestion label={isUpward ? 'Support & Coaching' : 'Teamwork & Alignment'} name="collaboration" value={responses.collaboration} onChange={handleResponseChange} disabled={isSubmitted} />
              <RatingQuestion label={isUpward ? 'Fairness & Recognition' : 'Strategic Influence'} name="impact" value={responses.impact} onChange={handleResponseChange} disabled={isSubmitted} />
              <div style={{ height: '60px' }} /> {/* Spacer */}
            </Section>
          </div>

          <Section title={isUpward ? 'Comments' : 'Narrative & Evolution'} icon={MessageSquare}>
            <div style={{ display: "flex", flexDirection: "column", gap: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: "uppercase" }}>{isUpward ? 'What your manager does well & where they could grow' : 'Key Achievements & Growth Areas'}</label>
              <textarea
                value={responses.comments || ''}
                onChange={(e) => handleResponseChange('comments', e.target.value)}
                disabled={isSubmitted}
                rows="6"
                placeholder="Discuss key wins, specific examples, and future trajectory..."
                style={{ 
                  padding: "16px", borderRadius: '12px', border: '1px solid var(--border)', 
                  fontSize: '14px', outline: "none", background: 'var(--bg)', resize: "none", lineHeight: 1.6,
                }}
              />
            </div>
          </Section>

          {isUpward && (
             <Section title="Overall Manager Rating" icon={Award}>
                <div style={{ display: "flex", flexDirection: "column", gap: '12px' }}>
                   <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: "uppercase" }}>How would you rate your manager overall? (1–5)</label>
                   <div style={{ display: "flex", gap: '10px' }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n} type="button" onClick={() => setOverallRating(n)} disabled={isSubmitted}
                          style={{
                            width: '52px', height: '52px', borderRadius: '14px', border: "none",
                            background: overallRating === n ? '#7C3AED' : 'var(--bg)',
                            color: overallRating === n ? "#fff" : 'var(--text-muted)',
                            fontSize: '16px', fontWeight: 800, cursor: isSubmitted ? "default" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: overallRating === n ? '0 4px 12px rgba(124,58,237,0.4)' : "none",
                            transition: "all 0.15s",
                          }}
                        >
                          {overallRating === n ? <Star size={20} fill="currentColor" /> : n}
                        </button>
                      ))}
                   </div>
                   {overallRating > 0 && <div style={{ fontSize: '13px', fontWeight: 700, color: '#7C3AED' }}>{overallRating}/5 selected</div>}
                </div>
             </Section>
          )}

          {isManagerForm && (
             <Section title="Administrative Verdict" icon={Award}>
                <div style={{ display: "flex", flexDirection: "column", gap: '16px' }}>
                   <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: "uppercase" }}>Overall Rank Recommendation</label>
                   <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: '16px' }}>
                      {['below_expectations', 'meets', 'above_expectations'].map(r => (
                        <button
                          key={r} type="button" onClick={() => setRating(r)} disabled={isSubmitted}
                          style={{
                            padding: "16px", borderRadius: '12px', border: rating === r ? '2px solid var(--primary)' : '1px solid var(--border)',
                            background: rating === r ? 'var(--primary-light)' : "#fff",
                            color: rating === r ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: 700, fontSize: '13px', textTransform: "capitalize", cursor: isSubmitted ? "default" : "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          {r.replace('_', ' ')}
                        </button>
                      ))}
                   </div>
                </div>
             </Section>
          )}

          {!isSubmitted && (
            <div style={{
              position: "fixed", bottom: '32px', left: "50%", transform: "translateX(-50%)",
              width: "100%", maxWidth: '900px', padding: "0 24px", zIndex: 100,
            }}>
               <div style={{
                 background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)",
                 border: '1px solid var(--border)', borderRadius: '16px', padding: "16px 24px",
                 display: "flex", justifyContent: "space-between", alignItems: "center",
                 boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
               }}>
                  <div style={{ display: "flex", alignItems: "center", gap: '16px' }}>
                     <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>EXECUTION SCORE:</div>
                     <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)' }}>{calculateScore(responses)} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ 5.0</span></div>
                  </div>
                  <div style={{ display: "flex", gap: '12px' }}>
                     <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
                       Dismiss
                     </button>
                     <button type="submit" disabled={submitting} className="btn btn-primary"
                       style={{ 
                         display: "flex", alignItems: "center", gap: '10px',
                         opacity: submitting ? 0.7 : 1,
                       }}>
                        {submitting ? "Deploying..." : "Submit Record"} <Save size={16} />
                     </button>
                  </div>
               </div>
            </div>
          )}
        </form>
      </div>
    </Layout>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card" style={{
      padding: '32px', display: "flex", flexDirection: "column", gap: '24px'
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: '12px', borderBottom: '1px solid var(--bg)', paddingBottom: '20px' }}>
         <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg)', display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={16} color="var(--text-muted)" />
         </div>
         <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function RatingQuestion({ label, name, value, onChange, disabled }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: '10px' }}>
      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{label}</label>
      <div style={{ display: "flex", gap: '8px' }}>
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num} type="button" disabled={disabled} onClick={() => onChange(name, num)}
            style={{
              width: '44px', height: '44px', borderRadius: '12px', border: "none",
              background: value === num ? 'var(--primary)' : 'var(--bg)',
              color: value === num ? "#fff" : 'var(--text-muted)',
              fontSize: '14px', fontWeight: 700, cursor: disabled ? "default" : "pointer",
              transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: value === num ? '0 4px 10px rgba(37,99,235,0.4)' : "none",
            }}
          >
            {value === num ? <Star size={18} fill="currentColor" /> : num}
          </button>
        ))}
      </div>
    </div>
  );
}
