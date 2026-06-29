import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { getReadiness, getTeamReadiness, sendNudge } from '../api/readiness';
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';

const SIGNAL_LABELS = {
  active_goal: 'Active Goal',
  progress_update: 'Progress Update',
  feedback_received: 'Feedback Received',
  achievement_logged: 'Achievement Logged',
  self_assessment: 'Self-Assessment',
};
const signalName = (s) => SIGNAL_LABELS[s.name] || (s.name || '').replace(/_/g, ' ');

const scoreColor = (score) => (score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444');
const isUrgent = (p) => typeof p === 'string' && p.trim().startsWith('⚠');

function ScoreRing({ score = 0, size = 160, stroke = 10 }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        <circle
          cx="50" cy="50" r="45" fill="none" stroke={scoreColor(score)} strokeWidth={stroke}
          strokeDasharray="283" strokeDashoffset={283 - (283 * score) / 100} strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-bold text-gray-900" style={{ fontSize: size / 4 }}>{Math.round(score)}%</span>
      </div>
    </div>
  );
}

function Nudges({ prompts }) {
  if (!prompts || prompts.length === 0) return null;
  return (
    <div className="space-y-2">
      {prompts.map((p, i) => {
        const urgent = isUrgent(p);
        return (
          <div key={i} className={`flex items-start gap-2 p-3 rounded-lg text-sm ${urgent ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-100'}`}>
            <AlertTriangle size={15} className={`flex-shrink-0 mt-0.5 ${urgent ? 'text-red-600' : 'text-amber-600'}`} />
            <span className="font-medium">{p}</span>
          </div>
        );
      })}
    </div>
  );
}

function SignalChecklist({ signals }) {
  return (
    <div className="space-y-3">
      {signals.map((signal, i) => {
        const passed = !!signal.passed;
        return (
          <div key={signal.name || i} className={`p-4 rounded-xl border flex items-center gap-4 ${passed ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-200'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${passed ? 'bg-emerald-100' : 'bg-gray-200'}`}>
              {passed ? <CheckCircle size={20} className="text-emerald-600" /> : <XCircle size={20} className="text-gray-400" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className={`font-semibold ${passed ? 'text-emerald-900' : 'text-gray-700'}`}>{signalName(signal)}</h4>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                  {passed ? '+20 pts' : '0 / 20'}
                </span>
              </div>
              {!passed && signal.label && <p className="text-sm text-gray-500 mt-1">{signal.label}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TeamMemberCard({ member }) {
  const [open, setOpen] = useState(false);
  const [nudging, setNudging] = useState(false);
  const score = member.score ?? 0;
  const signals = member.signals || [];
  const passedCount = signals.filter((s) => s.passed).length;
  const prompts = member.prompts || [];
  const hasUrgent = prompts.some(isUrgent);

  const handleNudge = async (e) => {
    e.stopPropagation();
    setNudging(true);
    try {
      await sendNudge(member.employee_id);
      toast.success(`Nudge sent to ${member.employee_name || 'employee'}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send nudge');
    } finally {
      setNudging(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full p-6 flex items-center gap-6 text-left hover:bg-gray-50/60 transition-colors">
        <ScoreRing score={score} size={72} stroke={12} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900">{member.employee_name || member.name || `Employee #${member.employee_id}`}</h3>
            {score < 50 && <span className="text-[10px] font-bold uppercase tracking-wide text-red-700 bg-red-100 px-2 py-0.5 rounded">Needs attention</span>}
            {hasUrgent && <span className="text-[10px] font-bold uppercase tracking-wide text-red-700 bg-red-50 px-2 py-0.5 rounded">⚠ Deadline soon</span>}
          </div>
          <p className="text-sm text-gray-500 mt-1">{passedCount}/5 signals met · {prompts.length} action{prompts.length === 1 ? '' : 's'} pending</p>
        </div>
        {prompts.length > 0 && (
          <button
            onClick={handleNudge}
            disabled={nudging}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <Bell size={15} /> {nudging ? 'Sending…' : 'Send nudge'}
          </button>
        )}
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
          <SignalChecklist signals={signals} />
          {prompts.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Nudges to send</h4>
              <Nudges prompts={prompts} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Readiness() {
  const currentUser = useAuthStore((s) => s.user);
  const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';

  const [readiness, setReadiness] = useState(null);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        if (isManager) {
          const res = await getTeamReadiness();
          if (active) setTeam(Array.isArray(res.data) ? res.data : []);
        } else {
          const res = await getReadiness(currentUser.id);
          if (active) setReadiness(res.data || null);
        }
      } catch (err) {
        if (active) toast.error('Failed to load readiness');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [currentUser?.id, isManager]);

  const CycleNote = ({ active: cycleActive }) => cycleActive ? null : (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800 font-medium">
      No active review cycle right now — readiness is evaluated against your lifetime evidence.
    </div>
  );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Review Readiness</h1>
          <p className="text-gray-500 mt-2">
            {currentUser?.role === 'admin'
              ? 'All employees, least prepared first — see who is unprepared for review season.'
              : isManager
                ? 'Your direct reports, least prepared first — see who needs a nudge before review season.'
                : 'Five signals, 20 points each. Hit all five to be fully review-ready.'}
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-16 text-center text-gray-500">Loading readiness…</div>
        ) : isManager ? (
          team.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-16 text-center">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="text-lg font-bold text-gray-900">{currentUser?.role === 'admin' ? 'No employees found' : 'No direct reports'}</h3>
              <p className="text-gray-500 mt-1">{currentUser?.role === 'admin' ? 'Readiness appears once employees exist.' : 'Team readiness appears once you have employees assigned to you.'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {team.map((member) => (
                <TeamMemberCard key={member.employee_id ?? member.name} member={member} />
              ))}
            </div>
          )
        ) : !readiness ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-16 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-lg font-bold text-gray-900">No readiness data yet</h3>
            <p className="text-gray-500 mt-1">Add goals, progress, and achievements to build your readiness score.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <CycleNote active={readiness.cycle_active} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-1 space-y-6">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col items-center text-center">
                  <ScoreRing score={readiness.score ?? 0} />
                  <h3 className="text-lg font-bold text-gray-900 mt-6">Readiness Score</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {(readiness.score ?? 0) === 100 ? 'Fully review-ready 🎉'
                      : (readiness.score ?? 0) >= 60 ? 'On track — a couple of items left.'
                      : 'Needs more evidence before review season.'}
                  </p>
                </div>

                {(readiness.prompts || []).length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">What to do next</h4>
                    <Nudges prompts={readiness.prompts} />
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Signals ({(readiness.signals || []).filter(s => s.passed).length}/5)</h4>
                <SignalChecklist signals={readiness.signals || []} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
