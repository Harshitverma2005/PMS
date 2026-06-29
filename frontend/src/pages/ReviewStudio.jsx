import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { feedbackService, aiDraftService, exportApiService, userService } from '../api';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';

export default function ReviewStudio() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const isManager = ['admin', 'manager'].includes(currentUser?.role);

  const [form, setForm] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0);
  const [employeeName, setEmployeeName] = useState('');
  const [selfText, setSelfText] = useState('');
  const [commentError, setCommentError] = useState('');
  const [ratingError, setRatingError] = useState('');
  const [highlightedCitation, setHighlightedCitation] = useState(null);
  const sidebarRefs = useRef({});

  useEffect(() => {
    if (!isManager) {
      setLoading(false);
      return;
    }
    loadForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, isManager]);

  const loadForm = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await feedbackService.getById(formId);
      const data = res?.data?.data ?? res?.data ?? null;
      if (!data || !data.id) {
        setNotFound(true);
        toast.error('Review form not found');
      } else {
        setForm(data);
        setComment(data.form_data?.comment ?? '');
        setRating(data.final_rating ?? 0);
        // An existing AI draft may already be attached to the form.
        if (data.ai_draft) setDraft(data.ai_draft);

        // Resolve the employee's name and their self-assessment text.
        userService.getById(data.employee_id)
          .then(r => setEmployeeName(r?.data?.name || ''))
          .catch(() => {});
        feedbackService.getMyForms()
          .then(r => {
            const list = Array.isArray(r?.data) ? r.data : (r?.data?.data ?? r?.data?.items ?? []);
            const self = list.find(f => f.form_type === 'self_assessment'
              && f.employee_id === data.employee_id
              && f.review_cycle_id === data.review_cycle_id
              && f.status === 'submitted');
            if (self) setSelfText(self.form_data?.comments || self.form_data?.summary || '');
          })
          .catch(() => {});
      }
    } catch (e) {
      if (e?.response?.status === 404) {
        setNotFound(true);
        toast.error('Review form not found');
      } else {
        toast.error('Unable to load review form');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDraft = async () => {
    setGenerating(true);
    try {
      const result = await aiDraftService.generateDraft(formId);
      // generateDraft returns the draft object directly.
      setDraft(result || null);
      toast.success('Draft generated');
    } catch (e) {
      toast.error(e?.message || 'Draft generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleCitationClick = (key) => {
    setHighlightedCitation(key);
    sidebarRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => setHighlightedCitation(null), 2000);
  };

  const handleSubmit = async () => {
    let valid = true;
    if (!comment.trim()) { setCommentError('Comment is required'); valid = false; }
    else setCommentError('');
    if (rating < 1 || rating > 5) { setRatingError('Rating must be between 1 and 5'); valid = false; }
    else setRatingError('');
    if (!valid) return;

    setSubmitting(true);
    try {
      await feedbackService.submitForm(formId, { form_data: { comment }, final_rating: rating });
      toast.success('Review submitted');
      loadForm();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportApiService.exportReview(formId);
    } catch (e) {
      toast.error(e?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (!isManager) {
    return (
      <Layout>
        <div className="p-8 text-center text-muted-foreground">
          Review Studio is reserved for managers and administrators.
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

  if (notFound || !form) {
    return (
      <Layout>
        <div className="p-8 text-center text-muted-foreground" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', height: '60vh', justifyContent: 'center' }}>
          <div className="text-4xl">🔍</div>
          <p>Review form not found.</p>
          <button onClick={() => navigate('/review-studio')} className="btn btn-secondary">
            Back to Review Studio
          </button>
        </div>
      </Layout>
    );
  }

  const displayEmployee = employeeName || form.employee_name || `Employee #${form.employee_id}`;
  const managerName = form.manager_of_record_name || form.manager_name || '';
  const citations = draft?.citations || {};
  const status = form.status || 'pending';
  const isSubmitted = status === 'submitted';
  const selfAssessment = selfText || '(Self-assessment not yet submitted)';

  return (
    <Layout>
      <div className="page active" id="page-review-studio-detail">
        {/* Header */}
        <div className="page-header flex justify-between items-center" style={{ marginBottom: '24px' }}>
          <div>
            <h1 className="page-title">Review Studio</h1>
            <p className="page-desc">
              Employee: {displayEmployee} · {managerName ? `Manager of Record: ${managerName}` : 'No manager of record'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span className="badge" style={{ padding: '6px 14px', background: isSubmitted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: isSubmitted ? '#10B981' : '#F59E0B' }}>
              {status}
            </span>
            <button
              onClick={handleExport}
              disabled={!isSubmitted || exporting}
              className="btn btn-secondary"
              style={{ opacity: (!isSubmitted || exporting) ? 0.5 : 1, cursor: (!isSubmitted || exporting) ? 'not-allowed' : 'pointer' }}
            >
              {exporting ? '⏳ Exporting...' : '📥 Export Review'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', height: 'calc(100vh - 140px)' }}>
          {/* Left Panel: AI Draft */}
          <div style={{ overflowY: 'auto', paddingRight: '24px', borderRight: '1px solid var(--border)' }}>
            {/* Regenerate Draft */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>AI-Generated Draft</h2>
              <button
                onClick={handleGenerateDraft}
                disabled={generating || isSubmitted}
                className="btn btn-primary"
                style={{ opacity: (generating || isSubmitted) ? 0.5 : 1 }}
              >
                {generating ? '⚙️ Generating...' : '✨ Generate Draft'}
              </button>
            </div>

            {draft ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Summary */}
                <div className="card">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Summary</h3>
                  <p className="text-sm text-foreground leading-relaxed">{draft.summary}</p>
                </div>

                {/* Strengths */}
                <div className="card">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Strengths</h3>
                  <ul className="space-y-2">
                    {(draft.strengths || []).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-green-500 flex-shrink-0">✓</span>
                        <span>
                          {s}
                          {citations[s] && (
                            <button
                              onClick={() => handleCitationClick(s)}
                              className="ml-1 text-xs text-primary hover:underline"
                            >
                              [{i + 1}]
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Growth Areas */}
                <div className="card">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Growth Areas</h3>
                  <ul className="space-y-2">
                    {(draft.growth_areas || []).map((g, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-amber-500 flex-shrink-0">→</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Suggested Rating */}
                <div className="card">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">AI Suggested Rating</h3>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(n => (
                      <span key={n} className={`text-2xl ${n <= (draft.suggested_rating || 0) ? 'opacity-100' : 'opacity-20'}`}>⭐</span>
                    ))}
                    <span className="ml-2 text-sm text-muted-foreground">({draft.suggested_rating ?? 0}/5)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card text-center py-12 text-muted-foreground">
                <div className="text-4xl mb-3">✨</div>
                <p>Click "Generate Draft" to create an evidence-backed review draft</p>
              </div>
            )}

            {/* Self Assessment */}
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-3">Employee Self-Assessment</h2>
              <div className="card bg-blue-50 border-blue-100">
                <p className="text-sm text-foreground">{selfAssessment}</p>
              </div>
            </div>

            {/* Manager Comment & Rating */}
            {!isSubmitted && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold mb-3">Your Review</h2>
                <div className="card">
                  <div className="mb-4">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                      Final Comment *
                    </label>
                    <textarea
                      className={`input h-32 resize-none ${commentError ? 'border-red-400' : ''}`}
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Write your final assessment..."
                    />
                    {commentError && <p className="text-xs text-red-500 mt-1">{commentError}</p>}
                  </div>
                  <div className="mb-4">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                      Final Rating *
                    </label>
                    <div className="flex gap-2">
                      {[1,2,3,4,5].map(n => (
                        <button
                          key={n}
                          onClick={() => setRating(n)}
                          className={`text-3xl transition-all hover:scale-110 ${n <= rating ? 'opacity-100' : 'opacity-20'}`}
                        >
                          ⭐
                        </button>
                      ))}
                      {rating > 0 && <span className="ml-2 text-sm text-muted-foreground self-center">({rating}/5)</span>}
                    </div>
                    {ratingError && <p className="text-xs text-red-500 mt-1">{ratingError}</p>}
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="btn btn-primary w-full"
                  >
                    {submitting ? 'Submitting...' : '📤 Submit Review'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Evidence Sidebar */}
          <div className="overflow-y-auto p-6 bg-secondary/20">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Evidence Citations</h2>
            {Object.keys(citations).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <div className="text-3xl mb-2">🔍</div>
                Citations will appear here after generating a draft
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(citations).map(([key, cits]) => (
                  <div
                    key={key}
                    ref={el => sidebarRefs.current[key] = el}
                    className={`card p-3 text-xs transition-all duration-300 ${
                      highlightedCitation === key ? 'border-primary shadow-md bg-primary/5' : ''
                    }`}
                  >
                    <p className="font-medium text-foreground mb-2 line-clamp-2">{key}</p>
                    {(Array.isArray(cits) ? cits : []).map((cit, i) => (
                      <div key={i} className="border-l-2 border-primary/30 pl-2 mb-2">
                        <p className="text-primary font-medium">{cit.event_type?.replace(/_/g, ' ')}</p>
                        <p className="text-muted-foreground">{cit.event_date}</p>
                        <p className="text-foreground">{cit.event_title}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
