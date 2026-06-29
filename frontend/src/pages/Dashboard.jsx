import { useEffect, useState } from 'react';
import { Target, Activity, Award, AlertTriangle, Users, FileText, CheckCircle, Building2, Bell, Gauge } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/auth';
import { dashboardService, userService, goalService, probationService } from '../api';
import { getReadiness, getTeamReadiness } from '../api/readiness';

const READY_THRESHOLD = 60;

function unwrapList(res) {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.items)) return d.items;
  return [];
}

function StatCard({ label, value, icon: Icon, trend, colorClass }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-2">{value}</h3>
          {trend && <p className="text-sm font-medium text-gray-500 mt-2">{trend}</p>}
        </div>
        <div className={`p-3 rounded-xl ${colorClass}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-gray-500">Loading dashboard…</div>
    </div>
  );
}

function ProbationSelfCheckins({ currentUser }) {
  const [record, setRecord] = useState(undefined); // undefined = loading, null = none
  const [active, setActive] = useState(null); // trigger being filled
  const [rating, setRating] = useState(3);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const res = await probationService.getByEmployee(currentUser.id);
      setRecord(res?.data ?? null);
    } catch {
      setRecord(null); // 404 → not on probation
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentUser.id]);

  if (!record) return null; // not on probation (or still loading → render nothing)

  const triggers = (record.triggers || []).filter(t => t.trigger_day > 0);
  // Pending = fired trigger where this employee hasn't submitted a self assessment yet
  const pending = triggers.filter(t => !(t.feedbacks || []).some(f => (f.feedback_type || '').toLowerCase() === 'self'));

  const submit = async () => {
    if (!active?.id) return;
    if (!comment.trim()) return toast.error('Add a short self-assessment');
    setSubmitting(true);
    try {
      await probationService.submitTriggerFeedback(active.id, {
        feedback_type: 'self',
        form_data: { rating: Number(rating), comment: comment.trim() },
      });
      toast.success('Self-assessment submitted');
      setActive(null); setComment(''); setRating(3);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 bg-amber-50/50">
        <h3 className="font-semibold text-gray-900">Probation Check-ins</h3>
        <p className="text-xs text-gray-500 mt-1">Submit your self-assessment at each milestone. It unlocks alongside your manager's once both are in.</p>
      </div>
      <div className="divide-y divide-gray-100">
        {triggers.length === 0 && (
          <div className="p-6 text-sm text-gray-500">No check-ins yet — milestones open at 30, 60 and 80 working days.</div>
        )}
        {triggers.map(t => {
          const mine = (t.feedbacks || []).find(f => (f.feedback_type || '').toLowerCase() === 'self');
          return (
            <div key={t.id} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-gray-900">Day {t.trigger_day} Check-in</div>
                <div className="text-xs text-gray-500 mt-1">
                  {mine ? `Self-assessment submitted · ${mine.form_data?.rating ?? '—'}/5` : 'Awaiting your self-assessment'}
                </div>
              </div>
              {!mine && (
                <button onClick={() => setActive(t)} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap">
                  Submit
                </button>
              )}
            </div>
          );
        })}
      </div>

      {active && (
        <div onClick={() => !submitting && setActive(null)} className="fixed inset-0 bg-black/45 flex items-center justify-center z-50 p-5">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Day {active.trigger_day} Self-Assessment</h3>
            <p className="text-sm text-gray-500 mt-1 mb-5">How do you feel you're progressing at this milestone?</p>
            <label className="text-xs font-semibold text-gray-500 uppercase">Self rating</label>
            <div className="flex gap-2 mt-2 mb-5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setRating(n)}
                  className={`flex-1 py-2.5 rounded-lg font-bold ${Number(rating) === n ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  {n}
                </button>
              ))}
            </div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Notes</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Wins, blockers, support you need…"
              className="w-full mt-2 p-3 border border-gray-200 rounded-xl text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setActive(null)} disabled={submitting} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={submit} disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeDashboard({ currentUser }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [meRes, rdRes, goalsRes] = await Promise.all([
          dashboardService.getMe(),
          getReadiness(currentUser.id).catch(() => null),
          goalService.getAll().catch(() => ({ data: [] })),
        ]);
        if (active) { setData(meRes.data || {}); setReadiness(rdRes?.data || null); setGoals(unwrapList(goalsRes)); }
      } catch (err) {
        toast.error('Failed to load dashboard');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [currentUser.id]);

  if (loading) return <LoadingState />;

  const d = data || {};

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome back, {currentUser.name}</h1>
          <p className="text-gray-500 mt-2">Here is your performance snapshot and active objectives.</p>
        </div>
        <button onClick={() => navigate('/goals/new')} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors flex items-center gap-2">
          <Target size={18} /> Propose Goal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Active Goals" value={d.active_goals ?? 0} icon={Target} colorClass="bg-blue-50 text-blue-600" trend={`${d.total_goals ?? 0} total`} />
        <StatCard label="Completed" value={d.completed_goals ?? 0} icon={CheckCircle} colorClass="bg-emerald-50 text-emerald-600" trend="This cycle" />
        <StatCard label="At Risk" value={d.at_risk_goals ?? 0} icon={AlertTriangle} colorClass={(d.at_risk_goals ?? 0) > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'} trend={(d.at_risk_goals ?? 0) > 0 ? 'Needs attention' : 'On track'} />
        <StatCard label="Avg Completion" value={`${Math.round(d.avg_completion_pct ?? 0)}%`} icon={Activity} colorClass="bg-purple-50 text-purple-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Review Readiness" value={`${readiness?.score ?? 0}%`} icon={Gauge}
          colorClass={(readiness?.score ?? 0) >= 80 ? 'bg-emerald-50 text-emerald-600' : (readiness?.score ?? 0) >= READY_THRESHOLD ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}
          trend={(readiness?.score ?? 0) === 100 ? 'Fully ready' : `${(readiness?.signals || []).filter(s => s.passed).length}/5 signals`} />
        <StatCard label="Pending Review Forms" value={d.pending_review_forms ?? 0} icon={FileText} colorClass="bg-orange-50 text-orange-600" trend={(d.pending_review_forms ?? 0) > 0 ? 'Action required' : 'All caught up'} />
        <StatCard label="Probation Status" value={d.probation_status ? String(d.probation_status).replace(/_/g, ' ') : '—'} icon={Award} colorClass="bg-amber-50 text-amber-600" />
        <StatCard label="Notifications" value={d.unread_notifications ?? 0} icon={Bell} colorClass="bg-blue-50 text-blue-600" trend="Unread" />
      </div>

      <ProbationSelfCheckins currentUser={currentUser} />

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
          <h3 className="font-semibold text-gray-900">Your Goals</h3>
          <button onClick={() => navigate('/goals')} className="text-sm font-medium text-blue-600 hover:text-blue-700">View All</button>
        </div>
        {goals.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No goals yet. Propose your first objective.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {goals.slice(0, 6).map(g => {
              const pct = g.completion_percentage ?? 0;
              const label = g.status === 'awaiting_feedback' ? 'Pending Review' : String(g.status || '').replace(/_/g, ' ');
              return (
                <div key={g.id} onClick={() => navigate(`/goals/${g.id}`)} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{g.title}</div>
                    <div className="text-xs text-gray-500 mt-1 capitalize">{label}</div>
                  </div>
                  <div className="flex items-center gap-2 w-36">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-600 w-8 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ManagerDashboard({ currentUser }) {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [belowReady, setBelowReady] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Scope to DIRECT REPORTS (manager_id), not the whole team, so a manager
        // never sees peers or other managers' reports who merely share a team.
        const [usersRes, goalsRes, rdRes] = await Promise.all([
          userService.getAll(),
          goalService.getAll().catch(() => ({ data: [] })),
          getTeamReadiness().catch(() => ({ data: [] })),
        ]);
        if (!active) return;
        const team = unwrapList(rdRes);
        setBelowReady(team.filter(r => (r.score ?? 0) < READY_THRESHOLD).length);
        const users = unwrapList(usersRes);
        const goals = unwrapList(goalsRes);
        const reports = users.filter(u => u.manager_id === currentUser.id);
        const rows = reports.map(u => {
          const mg = goals.filter(g => g.assignee_id === u.id);
          const st = (g) => (g.status || '').toLowerCase();
          const atRisk = mg.filter(g => g.is_at_risk || (st(g) === 'active' && (g.completion_percentage ?? 0) < 50));
          const avg = mg.length ? Math.round(mg.reduce((s, g) => s + (g.completion_percentage ?? 0), 0) / mg.length) : 0;
          return {
            user_id: u.id,
            name: u.name,
            total_goals: mg.length,
            active: mg.filter(g => st(g) === 'active').length,
            completed: mg.filter(g => st(g) === 'completed').length,
            at_risk: atRisk.length,
            avg_completion_pct: avg,
          };
        });
        setMembers(rows);
      } catch (err) {
        toast.error('Failed to load team dashboard');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [currentUser.id]);

  if (loading) return <LoadingState />;

  const totalGoals = members.reduce((s, m) => s + (m.total_goals || 0), 0);
  const activeGoals = members.reduce((s, m) => s + (m.active || 0), 0);
  const atRisk = members.reduce((s, m) => s + (m.at_risk || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{currentUser.name}'s Team Command Center</h1>
          <p className="text-gray-500 mt-2">Oversee your direct reports, approve goals, and manage workload.</p>
        </div>
        <button onClick={() => navigate('/goals/new')} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors flex items-center gap-2">
          <Target size={18} /> Assign Goal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <StatCard label="Team Members" value={members.length} icon={Users} colorClass="bg-blue-50 text-blue-600" />
        <StatCard label="Total Goals" value={totalGoals} icon={FileText} colorClass="bg-purple-50 text-purple-600" />
        <StatCard label="Active Goals" value={activeGoals} icon={Target} colorClass="bg-emerald-50 text-emerald-600" />
        <StatCard label="At Risk" value={atRisk} icon={AlertTriangle} colorClass={atRisk > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'} />
        <StatCard label="Not Review-Ready" value={belowReady} icon={Gauge}
          colorClass={belowReady > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}
          trend={belowReady > 0 ? 'Below 60% — nudge them' : 'Team is ready'} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
          <h3 className="font-semibold text-gray-900">Team Members</h3>
          <button onClick={() => navigate('/goals')} className="text-sm font-medium text-blue-600 hover:text-blue-700">View Goals →</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Member</th>
                <th className="px-6 py-4">Total Goals</th>
                <th className="px-6 py-4">Active</th>
                <th className="px-6 py-4">Completed</th>
                <th className="px-6 py-4">At Risk</th>
                <th className="px-6 py-4">Avg Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No team members found.</td></tr>
              ) : members.map(member => (
                <tr key={member.user_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">{member.name?.charAt(0)}</div>
                    <span className="font-medium text-gray-900">{member.name}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{member.total_goals ?? 0}</td>
                  <td className="px-6 py-4 text-gray-600">{member.active ?? 0}</td>
                  <td className="px-6 py-4 text-gray-600">{member.completed ?? 0}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${(member.at_risk ?? 0) > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {member.at_risk ?? 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{Math.round(member.avg_completion_pct ?? 0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [notReady, setNotReady] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [companyRes, rdRes] = await Promise.all([
          dashboardService.getCompany(),
          getTeamReadiness().catch(() => ({ data: [] })),
        ]);
        if (active) {
          setData(companyRes.data || {});
          setNotReady(unwrapList(rdRes).filter(r => (r.score ?? 0) < READY_THRESHOLD).length);
        }
      } catch (err) {
        toast.error('Failed to load company dashboard');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <LoadingState />;

  const d = data || {};
  const teams = Array.isArray(d.teams) ? d.teams : (d.teams?.items || []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Company Intelligence</h1>
          <p className="text-gray-500 mt-2">Company-wide analytics and review execution telemetry.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <StatCard label="Total Employees" value={d.total_employees ?? 0} icon={Users} colorClass="bg-blue-50 text-blue-600" />
        <StatCard label="Total Goals" value={d.total_goals ?? 0} icon={FileText} colorClass="bg-purple-50 text-purple-600" />
        <StatCard label="Active Goals" value={d.active_goals ?? 0} icon={Target} colorClass="bg-emerald-50 text-emerald-600" />
        <StatCard label="Completed" value={d.completed_goals ?? 0} icon={CheckCircle} colorClass="bg-emerald-50 text-emerald-600" />
        <StatCard label="At Risk" value={d.at_risk_goals ?? 0} icon={AlertTriangle} colorClass={(d.at_risk_goals ?? 0) > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Probation In Progress" value={d.probation_in_progress ?? 0} icon={Award} colorClass="bg-amber-50 text-amber-600" />
        <StatCard label="Open Review Cycles" value={d.open_review_cycles ?? 0} icon={Activity} colorClass="bg-blue-50 text-blue-600" />
        <StatCard label="Pending Escalations" value={d.pending_escalations ?? 0} icon={AlertTriangle} colorClass={(d.pending_escalations ?? 0) > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'} />
        <StatCard label="Not Review-Ready" value={notReady} icon={Gauge}
          colorClass={notReady > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}
          trend={notReady > 0 ? 'Employees below 60%' : 'All employees ready'} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50 flex items-center gap-2">
          <Building2 size={18} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Teams</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Team</th>
                <th className="px-6 py-4">Total Goals</th>
                <th className="px-6 py-4">Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teams.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No teams found.</td></tr>
              ) : teams.map(team => (
                <tr key={team.team_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{team.team_name}</td>
                  <td className="px-6 py-4 text-gray-600">{team.total_goals ?? 0}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 w-40">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.round(team.completion_pct ?? 0)}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-600 w-10 text-right">{Math.round(team.completion_pct ?? 0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const currentUser = useAuthStore((s) => s.user);

  const renderDashboard = () => {
    if (!currentUser) return <LoadingState />;
    if (currentUser.role === 'member') return <EmployeeDashboard currentUser={currentUser} />;
    if (currentUser.role === 'manager') return <ManagerDashboard currentUser={currentUser} />;
    if (currentUser.role === 'admin') return <AdminDashboard />;
    return null;
  };

  return <Layout>{renderDashboard()}</Layout>;
}
