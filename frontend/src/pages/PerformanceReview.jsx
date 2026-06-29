import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ClipboardList, User, Shield, CheckCircle, Clock, 
  AlertCircle, ChevronRight, Activity, Zap, Star
} from 'lucide-react';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/auth';
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

const asArray = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.items)) return d.items;
  return [];
};

const normalizeForm = (f) => ({
  ...f,
  employeeId: f.employeeId ?? f.employee_id,
  createdAt: f.createdAt ?? f.created_at,
});

export default function PerformanceReview() {
  const currentUser = useAuthStore((s) => s.user);

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  // "My Reviews" = review forms returned for the current user by the backend.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await feedbackService.getMyForms();
        if (active) setReviews(asArray(res).map(normalizeForm));
      } catch (err) {
        if (active) toast.error('Failed to load your reviews');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [currentUser?.id]);

  // "My Reviews" = forms ABOUT the current user (their self-assessment + the
  // manager review of them). Manager-feedback forms a manager must fill for their
  // reports live in Review Studio, not here.
  const myReviews = reviews.filter(f => (f.employee_id ?? f.employeeId) === currentUser?.id);

  // Employees action their own self-assessment AND their upward feedback (rating
  // their manager). The manager review of them is read-only, unlocked after cross-share.
  const pendingSelf = myReviews.filter(f => f.form_type === 'self_assessment' && f.status !== 'submitted');
  const pendingUpward = myReviews.filter(f => f.form_type === 'upward_feedback' && f.status !== 'submitted');
  const pendingManager = [];
  const submitted = myReviews.filter(f => f.status === 'submitted');

  return (
    <Layout>
      <div className="page active" id="page-performance">
        
        {/* Header */}
        <div className="page-header flex justify-between items-center" style={{ marginBottom: '24px' }}>
          <div>
            <div className="page-title">Performance Feedback</div>
            <div className="page-desc">Review cycle orchestration and personal performance history</div>
          </div>
          <div style={{ display: "flex", gap: '8px' }}>
            <div className="card" style={{
              padding: "8px 16px", borderRadius: '10px', fontSize: '12px', fontWeight: 700,
              color: 'var(--text-muted)', display: "flex", alignItems: "center", gap: '8px',
            }}>
               <Activity size={14} /> Total Cycles: {myReviews.length}
            </div>
          </div>
        </div>

        {/* Action Required Section */}
        {(pendingSelf.length > 0 || pendingUpward.length > 0 || pendingManager.length > 0) && (
          <div style={{ display: "flex", flexDirection: "column", gap: '16px', marginBottom: '24px' }}>
            <div style={{ display: "flex", alignItems: "center", gap: '8px', fontSize: '13px', fontWeight: 700, color: '#F59E0B' }}>
              <AlertCircle size={16} />
              <span style={{ textTransform: "uppercase" }}>Critical Action Required</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: '20px' }}>
              {pendingSelf.map(form => (
                <FeedbackCard key={form.id} form={form} isAction />
              ))}
              {pendingUpward.map(form => (
                <FeedbackCard key={form.id} form={form} isAction />
              ))}
              {pendingManager.map(form => (
                <FeedbackCard key={form.id} form={form} isAction />
              ))}
            </div>
          </div>
        )}

        {/* History / Completed Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: '16px' }}>
          <div style={{ display: "flex", alignItems: "center", gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>
            <Clock size={16} />
            <span style={{ textTransform: "uppercase" }}>Review Archive & Completed</span>
          </div>
          {loading ? (
            <div style={{
              textAlign: "center", padding: '64px', border: '2px dashed var(--border)',
              borderRadius: '12px', color: 'var(--text-muted)', fontSize: '14px',
            }}>
               Loading your reviews…
            </div>
          ) : submitted.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: '20px' }}>
              {submitted.map(form => (
                <FeedbackCard key={form.id} form={form} />
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: "center", padding: '64px', border: '2px dashed var(--border)',
              borderRadius: '12px', color: 'var(--text-muted)', fontSize: '14px',
            }}>
               No historical records detected in current data layer.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function FeedbackCard({ form, isAction }) {
  const isSelf = form.form_type === 'self_assessment';
  const isUpward = form.form_type === 'upward_feedback';
  const title = isSelf ? 'Self-Review Reflection' : isUpward ? 'Upward Feedback' : 'Manager Review';
  const tag = isSelf ? 'Self' : isUpward ? 'Manager rating' : 'Manager';
  const Icon = isSelf ? User : isUpward ? Star : Shield;
  const iconColor = isSelf ? 'var(--primary)' : isUpward ? '#7C3AED' : '#10B981';
  const iconBg = isSelf ? 'var(--primary-light)' : isUpward ? 'rgba(124,58,237,0.1)' : 'rgba(16,185,129,0.1)';

  return (
    <div className="card" style={{
      border: isAction ? '1px solid #F59E0B' : '1px solid var(--border)',
      padding: '24px', display: "flex", flexDirection: "column", gap: '16px',
      position: "relative"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: '12px', alignItems: "center" }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: iconBg,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={20} color={iconColor} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
              {title}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: '6px' }}>
               <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: "uppercase" }}>{tag}</span>
            </div>
          </div>
        </div>
        <div className="badge" style={{
          background: form.status === 'pending' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
          color: form.status === 'pending' ? '#F59E0B' : '#10B981',
        }}>
          {form.status}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: '4px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{form.cycle?.name || `Review Cycle #${form.review_cycle_id}`}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
           {isAction ? "Due for submission" : `Finalized on ${form.createdAt ? new Date(form.createdAt).toLocaleDateString() : '—'}`}
        </div>
      </div>

      <Link 
        to={`/performance/form/${form.id}`} 
        className={isAction ? "btn btn-primary" : "btn btn-secondary"}
        style={{ 
          marginTop: '8px', 
          width: '100%',
          display: "flex", alignItems: "center", justifyContent: "center", gap: '8px',
          textDecoration: "none"
        }}
      >
        {form.status === 'pending' ? (
          <>Action Form <Zap size={14} /></>
        ) : (
          <>View Records <Star size={14} /></>
        )}
      </Link>
    </div>
  );
}
