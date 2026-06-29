import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { ClipboardList, ChevronRight, User, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { feedbackService, userService } from '../api';
import toast from 'react-hot-toast';

// Defensively unwrap a list that may be an array, { data: [...] } or { items: [...] }.
function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export default function ReviewStudioHub() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const isManager = ['admin', 'manager'].includes(currentUser?.role);

  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isManager) {
      setLoading(false);
      return;
    }
    loadForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  const loadForms = async () => {
    setLoading(true);
    try {
      const [formsRes, usersRes] = await Promise.all([
        feedbackService.getMyForms(),
        userService.getAll().catch(() => ({ data: [] })),
      ]);
      const all = asList(formsRes?.data);
      const users = asList(usersRes?.data);
      const nameById = Object.fromEntries(users.map(u => [u.id, u.name]));
      // Only the manager-feedback forms this manager must complete (about reports).
      const mine = all
        .filter(f => f.form_type === 'manager_feedback' && f.employee_id !== currentUser?.id)
        .map(f => ({ ...f, employee_name: f.employee_name || nameById[f.employee_id] || `Employee #${f.employee_id}` }));
      setForms(mine);
    } catch (e) {
      toast.error('Unable to load review forms');
    } finally {
      setLoading(false);
    }
  };

  // Review Studio is reserved for managers and admins.
  if (!isManager) {
    return (
      <Layout>
        <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <AlertTriangle size={40} color="#DC2626" />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Access Restricted</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Review Studio is reserved for managers and administrators.</p>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page active" id="page-review-studio">
        <div className="page-header flex justify-between items-center" style={{ marginBottom: '24px' }}>
          <div>
            <div className="page-title">Review Studio</div>
            <div className="page-desc">AI-powered performance assessment and draft generation</div>
          </div>
        </div>

        {forms.length === 0 ? (
          <div className="card" style={{ padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '16px',
              background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ClipboardList size={32} color="var(--primary)" />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)' }}>No Active Reviews</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px', maxWidth: '400px' }}>
                You have no performance reviews to complete right now. New forms appear here when a review cycle is active.
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/cycles')}
              style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Go to Review Cycles <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {forms.map((form) => {
              const employeeName =
                form.employee_name || form.employee?.name || form.subject_name || 'Employee';
              const status = form.status || 'pending';
              const isSubmitted = status === 'submitted';
              const period = form.period || form.cycle?.period || '';
              const cycleName = form.cycle?.name || form.cycle_name || '';
              return (
                <div key={form.id} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={20} color="var(--primary)" />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{employeeName}</h3>
                        {period && (
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{period}</div>
                        )}
                      </div>
                    </div>
                    <span className="badge" style={{
                      background: isSubmitted ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                      color: isSubmitted ? '#10B981' : '#F59E0B',
                    }}>{status}</span>
                  </div>
                  {cycleName && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{cycleName}</div>}
                  <button
                    onClick={() => navigate(`/review-studio/${form.id}`)}
                    className="btn btn-primary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    Open in Studio <ChevronRight size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
