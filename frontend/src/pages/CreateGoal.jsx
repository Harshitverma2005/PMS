import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Send, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/auth';
import { goalService, userService } from '../api';
import { GoalLevel, GoalTag, GoalPriority } from '../constants/enums';
import { formatEnumValue } from '../utils/format';

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

// Same load model as Workload Intelligence: sum of active-goal weightage + a
// small concurrency penalty, bucketed into a status label.
function computeWorkload(activeGoals) {
  let load = 0;
  activeGoals.forEach(g => { load += (g.weightage || 0); });
  load += activeGoals.length * 5;
  let status = 'Healthy';
  if (load > 40) status = 'Busy';
  if (load > 70) status = 'High Load';
  if (load > 100) status = 'Overloaded';
  return { load: Math.round(load), status, count: activeGoals.length };
}

const WORKLOAD_COLOR = {
  Healthy: 'text-emerald-600', Busy: 'text-blue-600',
  'High Load': 'text-orange-600', Overloaded: 'text-red-600',
};

export default function CreateGoal() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const isManagerOrAdmin = currentUser?.role === 'manager' || currentUser?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [goals, setGoals] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee_id: currentUser?.role === 'member' ? (currentUser?.id || '') : '',
    level: GoalLevel.INDIVIDUAL,
    tag: GoalTag.QUARTERLY,
    priority: GoalPriority.MEDIUM,
    start_date: today,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [usersRes, goalsRes] = await Promise.all([
          userService.getAll(),
          goalService.getAll().catch(() => ({ data: [] })),
        ]);
        if (!active) return;
        setUsers(normalizeList(usersRes.data));
        setGoals(normalizeList(goalsRes.data));
      } catch (err) {
        toast.error('Failed to load users');
      }
    })();
    return () => { active = false; };
  }, []);

  // A manager may only assign to their direct reports; an admin to any member;
  // a member proposes goals for themselves.
  const candidates = useMemo(() => {
    if (currentUser?.role === 'manager') return users.filter(u => u.manager_id === currentUser.id);
    if (currentUser?.role === 'admin') return users.filter(u => u.role === 'member');
    return users.filter(u => u.id === currentUser?.id);
  }, [users, currentUser]);

  const workloadFor = (userId) => computeWorkload(
    goals.filter(g => g.assignee_id === userId && (g.status || '').toLowerCase() === 'active')
  );

  const selectedWorkload = formData.assignee_id ? workloadFor(Number(formData.assignee_id)) : null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.assignee_id) return toast.error('Please select an assignee');
    if (submitting) return;

    setSubmitting(true);
    try {
      await goalService.create({
        title: formData.title,
        description: formData.description,
        level: formData.level,
        tag: formData.tag,
        priority: formData.priority,
        start_date: formData.start_date,
        assignee_id: formData.assignee_id,
      });
      toast.success(isManagerOrAdmin ? 'Goal assigned successfully!' : 'Goal created!');
      navigate('/goals');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to create goal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {isManagerOrAdmin ? 'Assign Goal' : 'Propose New Goal'}
          </h1>
          <p className="text-gray-500 mt-2">
            {isManagerOrAdmin
              ? 'Assign a new objective to a team member.'
              : 'Create an objective to track toward your performance review.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-6">
          {isManagerOrAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
              <select name="assignee_id" value={formData.assignee_id} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" required>
                <option value="">Select team member...</option>
                {candidates.map(u => {
                  const wl = workloadFor(u.id);
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name} — {wl.status} ({wl.load} load · {wl.count} active)
                    </option>
                  );
                })}
              </select>
              {candidates.length === 0 && (
                <p className="text-xs text-amber-600 mt-2">You have no direct reports to assign goals to.</p>
              )}
              {selectedWorkload && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Briefcase size={15} className={WORKLOAD_COLOR[selectedWorkload.status] || 'text-gray-500'} />
                  <span className="text-gray-600">Current workload:</span>
                  <span className={`font-semibold ${WORKLOAD_COLOR[selectedWorkload.status] || 'text-gray-700'}`}>
                    {selectedWorkload.status}
                  </span>
                  <span className="text-gray-500">· {selectedWorkload.load} load units across {selectedWorkload.count} active goal{selectedWorkload.count === 1 ? '' : 's'}</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Goal Title</label>
            <input name="title" value={formData.title} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="e.g. Improve API Performance" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Target Outcome & Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[100px]" placeholder="What does success look like?" required />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Level</label>
              <select name="level" value={formData.level} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                {Object.values(GoalLevel).map(l => <option key={l} value={l}>{formatEnumValue(l)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tag</label>
              <select name="tag" value={formData.tag} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                {Object.values(GoalTag).map(t => <option key={t} value={t}>{formatEnumValue(t)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select name="priority" value={formData.priority} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                {Object.values(GoalPriority).map(p => <option key={p} value={p}>{formatEnumValue(p)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
            <button type="button" onClick={() => navigate('/goals')} className="px-5 py-2.5 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-medium shadow-sm transition-colors flex items-center gap-2">
              {isManagerOrAdmin ? <><Target size={18} /> Assign Goal</> : <><Send size={18} /> Create Goal</>}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
