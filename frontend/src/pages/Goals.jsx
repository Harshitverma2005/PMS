import { useEffect, useState } from 'react';
import { Target, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/auth';
import { goalService, userService } from '../api';
import { GoalStatus, STATUS_COLORS } from '../constants/enums';
import { formatEnumValue } from '../utils/format';

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export default function Goals() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const isManagerOrAdmin = currentUser?.role === 'manager' || currentUser?.role === 'admin';

  const [goals, setGoals] = useState([]);
  const [reportIds, setReportIds] = useState(new Set());
  const [members, setMembers] = useState([]); // admin: all real member-employees
  const [loading, setLoading] = useState(true);

  const loadGoals = async () => {
    try {
      const res = await goalService.getAll();
      setGoals(normalizeList(res.data));
    } catch (err) {
      toast.error('Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGoals();
    // For managers, figure out which assignees are their direct reports so we
    // only surface delete on those goals (the backend enforces this too).
    if (currentUser?.role === 'manager') {
      userService.getAll()
        .then(res => setReportIds(new Set(normalizeList(res.data).filter(u => u.manager_id === currentUser.id).map(u => u.id))))
        .catch(() => {});
    }
    // For admins, load all real member-employees for the per-member breakdown.
    if (currentUser?.role === 'admin') {
      userService.getAll()
        .then(res => setMembers(normalizeList(res.data).filter(u => u.role === 'member' && u.is_active !== false && !(u.email || '').endsWith('@opstree.com'))))
        .catch(() => {});
    }
  }, [currentUser]);

  // Only managers may delete their reports' goals. Admins cannot delete goals.
  const canDelete = (goal) => {
    if (currentUser?.role === 'manager') return reportIds.has(goal.assignee_id) || goal.creator_id === currentUser.id;
    return false;
  };
  const showActions = currentUser?.role === 'manager';

  const handleDelete = async (goal) => {
    if (!confirm(`Delete "${goal.title}"? This cannot be undone.`)) return;
    try {
      await goalService.delete(goal.id);
      toast.success('Goal deleted');
      await loadGoals();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete goal');
    }
  };

  const handleProgressChange = async (id, newProgress) => {
    try {
      await goalService.updateProgress(id, parseInt(newProgress, 10));
      await loadGoals();
    } catch (err) {
      toast.error('Failed to update progress');
    }
  };

  const handleApprove = async (id) => {
    try {
      await goalService.approve(id);
      toast.success('Goal approved!');
      await loadGoals();
    } catch (err) {
      toast.error('Failed to approve goal');
    }
  };

  const handleReject = async (id) => {
    try {
      await goalService.reject(id, 'Rejected');
      toast.success('Goal rejected.');
      await loadGoals();
    } catch (err) {
      toast.error('Failed to reject goal');
    }
  };

  // An admin's goals view is scoped to the actual employees (members),
  // excluding legacy @opstree.com seed accounts. Members/managers are already
  // scoped by the backend.
  const displayGoals = currentUser?.role === 'admin'
    ? goals.filter(g => g.assignee?.role === 'member' && !(g.assignee?.email || '').endsWith('@opstree.com'))
    : goals;

  const pendingApprovals = currentUser?.role === 'manager'
    ? displayGoals.filter(g => g.status === GoalStatus.PENDING_APPROVAL && g.assignee_id !== currentUser?.id)
    : [];

  // Admin: per-member task breakdown (assigned / completed / rejected / remaining).
  const memberRows = currentUser?.role === 'admin'
    ? members.map(u => {
        const gs = goals.filter(g => g.assignee_id === u.id);
        const completed = gs.filter(g => g.status === GoalStatus.COMPLETED).length;
        const rejected = gs.filter(g => g.status === GoalStatus.REJECTED).length;
        return { id: u.id, name: u.name, email: u.email, assigned: gs.length, completed, rejected, remaining: gs.length - completed - rejected };
      }).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    : [];

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-end border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Goals & Objectives</h1>
            <p className="text-gray-500 mt-2">Track progress, manage proposals, and align on objectives.</p>
          </div>
          {currentUser?.role !== 'admin' && (
            <button onClick={() => navigate('/goals/new')} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors flex items-center gap-2">
              <Target size={18} /> {currentUser?.role === 'manager' ? 'Assign Goal' : 'Propose Goal'}
            </button>
          )}
        </div>

        {currentUser?.role === 'admin' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50">
              <h3 className="font-semibold text-gray-900">Task Breakdown by Employee</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4 text-center">Assigned</th>
                    <th className="px-6 py-4 text-center">Completed</th>
                    <th className="px-6 py-4 text-center">Rejected</th>
                    <th className="px-6 py-4 text-center">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading…</td></tr>
                  ) : memberRows.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No employees found.</td></tr>
                  ) : memberRows.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">{m.name?.charAt(0)?.toUpperCase()}</div>
                          <div>
                            <div className="font-medium text-gray-900">{m.name}</div>
                            <div className="text-xs text-gray-500">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-gray-900">{m.assigned}</td>
                      <td className="px-6 py-4 text-center"><span className="font-semibold text-emerald-700">{m.completed}</span></td>
                      <td className="px-6 py-4 text-center"><span className="font-semibold text-red-600">{m.rejected}</span></td>
                      <td className="px-6 py-4 text-center"><span className="font-semibold text-amber-600">{m.remaining}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isManagerOrAdmin && pendingApprovals.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
            <h3 className="font-semibold text-orange-900 mb-4 flex items-center gap-2"><AlertCircle size={20} /> Pending Goal Approvals</h3>
            <div className="space-y-4">
              {pendingApprovals.map(goal => (
                <div key={goal.id} className="bg-white rounded-xl p-4 shadow-sm border border-orange-100 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-gray-900">{goal.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Requested by {goal.assignee?.name || goal.creator?.name || '—'} • Priority: {formatEnumValue(goal.priority)} • Weightage: {goal.weightage ?? 0}%
                    </p>
                    {goal.description && <p className="text-sm text-gray-500 mt-1 line-clamp-1 italic">{goal.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleReject(goal.id)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Reject</button>
                    <button onClick={() => handleApprove(goal.id)} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Approve</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentUser?.role !== 'admin' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50">
            <h3 className="font-semibold text-gray-900">All Goals</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Goal Title</th>
                  {isManagerOrAdmin && <th className="px-6 py-4">Assignee</th>}
                  <th className="px-6 py-4">Progress</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                  {showActions && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={isManagerOrAdmin ? (showActions ? 6 : 5) : 4} className="px-6 py-8 text-center text-gray-500">Loading goals…</td></tr>
                ) : displayGoals.length === 0 ? (
                  <tr><td colSpan={isManagerOrAdmin ? (showActions ? 6 : 5) : 4} className="px-6 py-8 text-center text-gray-500">No goals found.</td></tr>
                ) : (
                  displayGoals.map(goal => {
                    const progress = goal.completion_percentage ?? 0;
                    const isOwner = currentUser?.id === goal.assignee_id;
                    return (
                      <tr key={goal.id} onClick={() => navigate(`/goals/${goal.id}`)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{goal.title}</div>
                          <div className="text-xs text-gray-500 mt-1 line-clamp-1">{goal.description}</div>
                        </td>
                        {isManagerOrAdmin && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">{goal.assignee?.name?.charAt(0) || '?'}</div>
                              <span className="text-sm font-medium text-gray-900">{goal.assignee?.name || 'Unassigned'}</span>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          {isOwner && goal.status === GoalStatus.ACTIVE ? (
                            <div className="flex items-center gap-3 w-40">
                              <input
                                type="range"
                                min="0" max="100"
                                defaultValue={progress}
                                onMouseUp={(e) => handleProgressChange(goal.id, e.target.value)}
                                onTouchEnd={(e) => handleProgressChange(goal.id, e.target.value)}
                                className="flex-1 accent-blue-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-sm font-bold text-blue-600 w-10 text-right">{progress}%</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 w-32">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-xs font-medium text-gray-600 w-8 text-right">{progress}%</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatEnumValue(goal.priority)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max ${STATUS_COLORS[goal.status] || 'bg-gray-100 text-gray-700'}`}>
                            {goal.status === GoalStatus.ACTIVE ? <CheckCircle size={12} /> : goal.status === GoalStatus.PENDING_APPROVAL ? <Clock size={12} /> : null}
                            {formatEnumValue(goal.status)}
                          </span>
                        </td>
                        {showActions && (
                          <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            {canDelete(goal) ? (
                              <button
                                onClick={() => handleDelete(goal)}
                                title="Delete goal"
                                className="inline-flex items-center justify-center p-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    </Layout>
  );
}
