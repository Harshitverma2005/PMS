import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Target, Activity, Award, Calendar,
  AlertTriangle, CheckCircle, User, Briefcase, Plus, Trash2, X
} from 'lucide-react';
import Layout from '../components/Layout';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth';
import { goalService } from '../api';
import { GoalStatus, STATUS_COLORS, PRIORITY_COLORS } from '../constants/enums';
import { formatEnumValue } from '../utils/format';
import { formatDate, formatDateTime } from '../utils/format';

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-200">
      <div className="flex items-center gap-2 text-gray-500">
        <Icon size={16} className={color} />
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 mt-2">{value}</div>
    </div>
  );
}

export default function GoalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  const [goal, setGoal] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);
  const [subtaskForm, setSubtaskForm] = useState({ title: '', weightage: 0 });
  const [reviewModal, setReviewModal] = useState(null); // { action: 'reject' | 'modify' }

  const loadGoal = async () => {
    try {
      const res = await goalService.getById(id);
      const g = res.data?.data || res.data;
      setGoal(g);
      setProgress(g?.completion_percentage ?? 0);
    } catch (err) {
      toast.error('Failed to load goal');
      setGoal(null);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await goalService.getHistory(id);
      setHistory(normalizeList(res.data));
    } catch (err) {
      // history is non-critical; ignore silently
    }
  };

  useEffect(() => {
    setLoading(true);
    loadGoal();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh] text-gray-500">Loading goal…</div>
      </Layout>
    );
  }

  if (!goal) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <AlertTriangle size={48} className="text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Goal not found</h2>
          <p className="text-gray-500 mt-2">This objective may have been removed.</p>
          <button onClick={() => navigate('/goals')} className="mt-6 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
            Back to Goals
          </button>
        </div>
      </Layout>
    );
  }

  const isOwner = currentUser?.id === goal.assignee_id;
  const isManagerOrAdmin = currentUser?.role === 'manager' || currentUser?.role === 'admin';
  const canApprove = isManagerOrAdmin && !isOwner;
  const subtasks = Array.isArray(goal.subtasks) ? goal.subtasks : [];
  const feedbacks = Array.isArray(goal.feedbacks) ? goal.feedbacks : [];
  const statusLabel = goal.status === GoalStatus.AWAITING_FEEDBACK ? 'Pending Review' : formatEnumValue(goal.status);

  // Latest manager review comment (changes requested / reject) to surface to the employee.
  const norm = (s) => String(s || '').toLowerCase().split('.').pop();
  const lastReview = [...history].reverse().find(h =>
    h.comment && h.comment.trim() && h.comment !== 'Submitted for review' &&
    norm(h.from_status) === 'awaiting_feedback'
  );

  const refresh = async () => {
    await Promise.all([loadGoal(), loadHistory()]);
  };

  const handleApprove = async () => {
    try {
      await goalService.approve(goal.id);
      toast.success('Goal approved');
      await refresh();
    } catch (err) {
      toast.error('Failed to approve goal');
    }
  };
  const handleReject = async () => {
    try {
      await goalService.reject(goal.id, 'Rejected');
      toast.success('Goal rejected');
      await refresh();
    } catch (err) {
      toast.error('Failed to reject goal');
    }
  };
  const handleSubmit = async () => {
    try {
      await goalService.submit(goal.id);
      toast.success('Submitted for approval');
      await refresh();
    } catch (err) {
      toast.error('Failed to submit goal');
    }
  };
  const handleComplete = async () => {
    try {
      await goalService.complete(goal.id);
      toast.success('Submitted for manager review');
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to submit for review');
    }
  };
  const handleReview = async (action, comment = '') => {
    try {
      await goalService.reviewCompletion(goal.id, action, comment);
      toast.success(action === 'accept' ? 'Goal accepted as complete' : action === 'reject' ? 'Goal rejected' : 'Changes requested — sent back to employee');
      setReviewModal(null);
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Review failed');
    }
  };
  const handleSaveProgress = async () => {
    try {
      await goalService.updateProgress(goal.id, parseInt(progress, 10));
      toast.success('Progress updated');
      await refresh();
    } catch (err) {
      toast.error('Failed to update progress');
    }
  };

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    try {
      await goalService.addSubtask(goal.id, {
        title: subtaskForm.title,
        weightage: Number(subtaskForm.weightage) || 0,
      });
      toast.success('Subtask added');
      setShowSubtaskModal(false);
      setSubtaskForm({ title: '', weightage: 0 });
      await refresh();
    } catch (err) {
      toast.error('Failed to add subtask');
    }
  };
  const handleToggleSubtask = async (subtask) => {
    try {
      await goalService.updateSubtask(goal.id, subtask.id, { is_completed: !subtask.is_completed });
      await refresh();
    } catch (err) {
      toast.error('Failed to update subtask');
    }
  };
  const handleDeleteSubtask = async (subtask) => {
    try {
      await goalService.deleteSubtask(goal.id, subtask.id);
      toast.success('Subtask deleted');
      await refresh();
    } catch (err) {
      toast.error('Failed to delete subtask');
    }
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Breadcrumb + actions */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Link to="/goals" className="hover:text-gray-900">Goals</Link>
              <span>/</span>
              <span className="text-gray-900">{goal.title}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {goal.status === GoalStatus.PENDING_APPROVAL && canApprove && (
              <>
                <button onClick={handleReject} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Reject</button>
                <button onClick={handleApprove} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Approve</button>
              </>
            )}
            {(goal.status === GoalStatus.DRAFT || goal.status === GoalStatus.REJECTED) && isOwner && (
              <button onClick={handleSubmit} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Submit for Approval</button>
            )}
            {goal.status === GoalStatus.ACTIVE && isOwner && (
              <button onClick={handleComplete} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2">
                <CheckCircle size={16} /> Mark as Done
              </button>
            )}
            {goal.status === GoalStatus.AWAITING_FEEDBACK && isOwner && (
              <span className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">Pending manager review</span>
            )}
            {goal.status === GoalStatus.AWAITING_FEEDBACK && canApprove && (
              <>
                <button onClick={() => setReviewModal({ action: 'modify' })} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Request Changes</button>
                <button onClick={() => setReviewModal({ action: 'reject' })} className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg">Reject</button>
                <button onClick={() => handleReview('accept')} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2"><CheckCircle size={16} /> Accept</button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header card */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold text-gray-900">{goal.title}</h1>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[goal.status] || 'bg-gray-100 text-gray-700'}`}>
                      {statusLabel}
                    </span>
                    {goal.is_at_risk && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">At Risk</span>
                    )}
                  </div>
                  <p className="text-gray-500 mt-2 max-w-2xl">{goal.description || 'No description provided.'}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Target size={24} className="text-blue-600" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
                <StatCard label="Progress" value={`${goal.completion_percentage ?? 0}%`} icon={Activity} color="text-blue-600" />
                <StatCard label="Weightage" value={`${goal.weightage ?? 0}%`} icon={Award} color="text-purple-600" />
                <StatCard label="Level" value={formatEnumValue(goal.level)} icon={Briefcase} color="text-emerald-600" />
                <StatCard label="Due" value={goal.due_date ? formatDate(goal.due_date) : '—'} icon={Calendar} color="text-amber-600" />
              </div>
            </div>

            {/* Manager review feedback (changes requested / rejected) */}
            {lastReview && (goal.status === GoalStatus.ACTIVE || goal.status === GoalStatus.REJECTED) && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-amber-800 font-semibold mb-1">
                  <AlertTriangle size={16} /> Manager requested changes
                </div>
                <p className="text-sm text-amber-900">"{lastReview.comment}"</p>
                <p className="text-xs text-amber-700 mt-1">— {lastReview.actor_name || 'Manager'}{lastReview.timestamp ? ` · ${formatDate(lastReview.timestamp)}` : ''}. Update the goal and mark it done again.</p>
              </div>
            )}

            {/* Progress editor (owner, active) */}
            {goal.status === GoalStatus.ACTIVE && isOwner && (
              <div className="bg-white p-6 rounded-2xl border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4">Update Progress</h3>
                <div className="flex items-center gap-4">
                  <input
                    type="range" min="0" max="100" value={progress}
                    onChange={(e) => setProgress(e.target.value)}
                    className="flex-1 accent-blue-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-lg font-bold text-blue-600 w-14 text-right">{progress}%</span>
                  <button onClick={handleSaveProgress} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Save</button>
                </div>
                <p className="text-xs text-gray-500 mt-3">Drag to update your completion, then Save. Mark the goal complete when you reach your target.</p>
              </div>
            )}

            {/* Subtasks */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Subtasks</h3>
                {(isOwner || isManagerOrAdmin) && (
                  <button onClick={() => setShowSubtaskModal(true)} className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <Plus size={16} /> Add
                  </button>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {subtasks.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500 text-center">No subtasks yet.</div>
                ) : subtasks.map(st => (
                  <div key={st.id} className="px-6 py-4 flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!st.is_completed}
                        onChange={() => handleToggleSubtask(st)}
                        disabled={!isOwner && !isManagerOrAdmin}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className={`text-sm ${st.is_completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{st.title}</span>
                      {st.weightage != null && <span className="text-xs text-gray-400">({st.weightage}%)</span>}
                    </label>
                    {(isOwner || isManagerOrAdmin) && (
                      <button onClick={() => handleDeleteSubtask(st)} className="text-gray-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Feedback */}
            {feedbacks.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="font-semibold text-gray-900">Feedback</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {feedbacks.map((fb, i) => (
                    <div key={i} className="px-6 py-4">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{formatEnumValue(fb.feedback_type)}</span>
                      {fb.deliverables && <p className="text-sm text-gray-700 mt-1">{fb.deliverables}</p>}
                      {fb.evaluator_comment && <p className="text-sm text-gray-500 mt-1 italic">{fb.evaluator_comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Score */}
            {goal.score && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Score</h3>
                <div className="flex items-center gap-2">
                  <Award size={18} className="text-purple-600" />
                  <span className="text-sm font-semibold text-gray-900">{formatEnumValue(goal.score.rating)}</span>
                </div>
                {goal.score.scored_at && <p className="text-xs text-gray-500 mt-2">Scored {formatDateTime(goal.score.scored_at)}</p>}
              </div>
            )}

            {/* History timeline */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-semibold text-gray-900">History</h3>
              </div>
              <div className="p-6 space-y-5">
                {history.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">No history recorded for this goal yet.</div>
                ) : history.map((event, i) => (
                  <div key={event.id ?? i} className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
                      <Activity size={12} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {event.from_status
                          ? `${formatEnumValue(event.from_status)} → ${formatEnumValue(event.to_status)}`
                          : formatEnumValue(event.to_status || 'Updated')}
                        {event.actor_name ? ` · ${event.actor_name}` : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {event.comment ? `"${event.comment}" · ` : ''}
                        {event.timestamp || event.created_at ? formatDateTime(event.timestamp || event.created_at) : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-semibold text-gray-900">Details</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Priority</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${PRIORITY_COLORS[goal.priority] || 'bg-gray-100 text-gray-700'}`}>
                    {formatEnumValue(goal.priority)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Tag</span>
                  <span className="text-sm font-semibold text-gray-900">{formatEnumValue(goal.tag)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Weightage</span>
                  <span className="text-sm font-semibold text-gray-900">{goal.weightage ?? 0}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Start date</span>
                  <span className="text-sm font-semibold text-gray-900">{goal.start_date ? formatDate(goal.start_date) : '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Due date</span>
                  <span className="text-sm font-semibold text-gray-900">{goal.due_date ? formatDate(goal.due_date) : '—'}</span>
                </div>

                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Assignee</div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">{goal.assignee?.name?.charAt(0) || '?'}</div>
                      <span className="text-sm font-medium text-gray-900">{goal.assignee?.name || 'Unassigned'}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Created by</div>
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{goal.creator?.name || 'Unknown'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add subtask modal */}
      {showSubtaskModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowSubtaskModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Add Subtask</h3>
              <button onClick={() => setShowSubtaskModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddSubtask} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  value={subtaskForm.title}
                  onChange={(e) => setSubtaskForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Subtask title" required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Weightage (%)</label>
                <input
                  type="number" min="0" max="100"
                  value={subtaskForm.weightage}
                  onChange={(e) => setSubtaskForm(prev => ({ ...prev, weightage: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowSubtaskModal(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Add Subtask</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reviewModal && (
        <ReviewModal
          action={reviewModal.action}
          onClose={() => setReviewModal(null)}
          onSubmit={(comment) => handleReview(reviewModal.action, comment)}
        />
      )}
    </Layout>
  );
}

function ReviewModal({ action, onClose, onSubmit }) {
  const [comment, setComment] = useState('');
  const isReject = action === 'reject';
  const title = isReject ? 'Reject Goal' : 'Request Changes';
  const desc = isReject
    ? 'Explain why this goal is rejected. The employee will see your comment.'
    : 'Describe what needs changing. The goal goes back to the employee with your comment.';
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{desc}</p>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="Add a comment for the employee…"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
          <button
            onClick={() => { if (!comment.trim()) return; onSubmit(comment.trim()); }}
            disabled={!comment.trim()}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${isReject ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isReject ? 'Reject' : 'Send Back'}
          </button>
        </div>
      </div>
    </div>
  );
}
