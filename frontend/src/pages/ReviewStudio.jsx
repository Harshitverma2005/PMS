import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import apiClient from '../api/apiClient';
import { generateDraft } from '../api/aiDraft';
import { exportReview } from '../api/exportApi';
import toast from 'react-hot-toast';

export default function ReviewStudio() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0);
  const [commentError, setCommentError] = useState('');
  const [ratingError, setRatingError] = useState('');
  const [highlightedCitation, setHighlightedCitation] = useState(null);
  const sidebarRefs = useRef({});

  useEffect(() => {
    if (user?.role === 'member') { navigate('/'); return; }
    loadForm();
  }, [formId]);

  const loadForm = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/review-forms/${formId}`);
      setForm(res.data);
      if (res.data?.form_data?.comment) setComment(res.data.form_data.comment);
      if (res.data?.final_rating) setRating(res.data.final_rating);
    } catch {
      toast.error('Failed to load review form');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDraft = async () => {
    setGenerating(true);
    try {
      const draft = await generateDraft(formId);
      setForm(prev => ({ ...prev, ai_draft: draft, citations: draft.citations }));
      toast.success('Draft generated! ✨');
    } catch (err) {
      if (err.message?.includes('temporarily unavailable')) {
        toast.error(err.message);
      } else if (err.response?.status === 422) {
        toast.error('No completed goals found — cannot generate draft yet');
      } else {
        toast.error(err.message || 'Failed to generate draft');
      }
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
      await apiClient.post(`/review-forms/${formId}/submit`, {
        form_data: { comment },
        final_rating: rating,
      });
      toast.success('Review submitted! 🎉');
      await loadForm();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportReview(formId);
    } catch (err) {
      toast.error('Export failed — please try again');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-spin mb-4">⚙️</div>
          <p className="text-muted-foreground">Loading Review Studio...</p>
        </div>
      </div>
    );
  }

  if (!form) return <div className="p-8 text-center text-muted-foreground">Review form not found</div>;

  const draft = form.ai_draft;
  const citations = form.citations || {};
  const isSubmitted = form.status === 'submitted';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Review Studio</h1>
          <p className="text-xs text-muted-foreground">
            Employee #{form.employee_id} · {form.manager_of_record_name ? `Manager of Record: ${form.manager_of_record_name}` : 'No manager of record'}
          </p>
        </div>
        <div className="flex gap-3">
          <span className={`badge border px-3 py-1 text-xs font-semibold ${isSubmitted ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
            {form.status}
          </span>
          <button
            onClick={handleExport}
            disabled={!isSubmitted}
            className="btn btn-secondary disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            📥 Export Review
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 h-[calc(100vh-73px)]">
        {/* Left Panel: AI Draft */}
        <div className="lg:col-span-2 overflow-y-auto p-6 border-r border-border">
          {/* Regenerate Draft */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">AI-Generated Draft</h2>
            <button
              onClick={handleGenerateDraft}
              disabled={generating || isSubmitted}
              className="btn btn-primary text-sm disabled:opacity-40"
            >
              {generating ? '⚙️ Generating...' : '✨ Generate Draft'}
            </button>
          </div>

          {draft ? (
            <div className="space-y-6">
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
                    <span key={n} className={`text-2xl ${n <= draft.suggested_rating ? 'opacity-100' : 'opacity-20'}`}>⭐</span>
                  ))}
                  <span className="ml-2 text-sm text-muted-foreground">({draft.suggested_rating}/5)</span>
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
              <p className="text-sm text-foreground">
                {form.form_data?.self_assessment || '(Not yet submitted)'}
              </p>
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
                  {(cits || []).map((cit, i) => (
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
  );
}
