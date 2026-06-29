import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/auth';
import { goalService, userService } from '../api';
import toast from 'react-hot-toast';

function unwrapList(res) {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.items)) return d.items;
  return [];
}

// Estimate load from a user's active goals. The backend goal carries a `weightage`
// (10–40 per goal); we sum it and add a small concurrency penalty per active goal.
function computeWorkload(activeGoals) {
  let load = 0;
  activeGoals.forEach(g => { load += (g.weightage || 0); });
  load += activeGoals.length * 5; // context-switching penalty
  let status = 'Healthy';
  if (load > 40) status = 'Busy';
  if (load > 70) status = 'High Load';
  if (load > 100) status = 'Overloaded';
  return { load: Math.round(load), status, count: activeGoals.length };
}

export default function WorkloadIntelligence() {
  const currentUser = useAuthStore((s) => s.user) || {};
  const [users, setUsers] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [goalsRes, usersRes] = await Promise.all([
          goalService.getAll(),
          userService.getAll().catch(() => ({ data: [] })),
        ]);
        setGoals(unwrapList(goalsRes));
        setUsers(unwrapList(usersRes));
      } catch (err) {
        toast.error('Failed to load workload data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Who do we show?
  let targetUsers = [];
  if (currentUser.role === 'member') {
    targetUsers = [currentUser];
  } else if (currentUser.role === 'manager') {
    targetUsers = users.filter(u => u.manager_id === currentUser.id);
    if (targetUsers.length === 0) targetUsers = users.filter(u => u.id === currentUser.id);
  } else {
    // Admin: all real member-employees (exclude legacy @opstree.com seed + inactive).
    targetUsers = users.filter(u => u.role === 'member' && u.is_active !== false && !(u.email || '').endsWith('@opstree.com'));
  }

  const isActive = (g) => (g.status || '').toLowerCase() === 'active';
  const workloads = targetUsers.map(u => ({
    user: u,
    workload: computeWorkload(goals.filter(g => g.assignee_id === u.id && isActive(g))),
  }));

  const totalLoad = workloads.reduce((sum, w) => sum + w.workload.load, 0);
  const avgLoad = workloads.length > 0 ? Math.round(totalLoad / workloads.length) : 0;
  const statusCounts = workloads.reduce((acc, w) => {
    acc[w.workload.status] = (acc[w.workload.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Workload Intelligence</h1>
          <p className="text-gray-500 mt-2">Data-driven capacity planning and overload prevention.</p>
        </div>

        {currentUser.role !== 'member' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Avg Team Load</p>
              <h3 className="text-3xl font-bold text-gray-900">{avgLoad}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Healthy</p>
              <h3 className="text-3xl font-bold text-emerald-900">{statusCounts['Healthy'] || 0}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-orange-200 shadow-sm">
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-2">High Load</p>
              <h3 className="text-3xl font-bold text-orange-900">{statusCounts['High Load'] || 0}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-sm">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Overloaded</p>
              <h3 className="text-3xl font-bold text-red-900">{statusCounts['Overloaded'] || 0}</h3>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50">
            <h3 className="font-semibold text-gray-900">Capacity Distribution</h3>
          </div>
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="text-center text-gray-500 py-6">Loading…</div>
            ) : workloads.length === 0 ? (
              <div className="text-center text-gray-500 py-6">No team members to show.</div>
            ) : workloads.map(({ user, workload }) => {
              const pct = Math.min(100, Math.round((workload.load / 120) * 100));
              let colorClass = 'bg-emerald-500', bgClass = 'bg-emerald-50';
              if (workload.status === 'Busy') { colorClass = 'bg-blue-500'; bgClass = 'bg-blue-50'; }
              if (workload.status === 'High Load') { colorClass = 'bg-orange-500'; bgClass = 'bg-orange-50'; }
              if (workload.status === 'Overloaded') { colorClass = 'bg-red-500'; bgClass = 'bg-red-50'; }

              return (
                <div key={user.id} className="relative">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-xs">{user.name?.charAt(0)?.toUpperCase()}</div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{user.name}</h4>
                        <p className="text-xs text-gray-500">{workload.count} active goals</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${bgClass} text-gray-900 inline-block mb-1`}>
                        {workload.status}
                      </span>
                      <p className="text-sm font-bold text-gray-900">{workload.load} load units</p>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${colorClass} transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 flex gap-4">
          <TrendingUp className="text-blue-600 flex-shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-blue-900">How is this calculated?</h3>
            <p className="text-blue-800 mt-2 text-sm leading-relaxed">
              Workload Intelligence analyzes each employee's <b>active</b> goals. It sums the strategic weightage of those goals and adds a small penalty for concurrent goals to account for context switching, then classifies capacity as Healthy, Busy, High Load, or Overloaded.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
