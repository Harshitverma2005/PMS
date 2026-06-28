import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { getTeamReadiness } from '../api/readiness';
import toast from 'react-hot-toast';

const scoreColor = (score) => {
  if (score >= 70) return 'bg-green-100 text-green-700 border-green-200';
  if (score >= 40) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
};

const scoreBg = (score) => {
  if (score >= 70) return 'from-green-400 to-emerald-500';
  if (score >= 40) return 'from-amber-400 to-orange-500';
  return 'from-red-400 to-rose-500';
};

const SIGNAL_ICONS = ['🎯', '📈', '💬', '⭐', '📝'];

export default function Readiness() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [teamData, setTeamData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  const role = user?.role;

  useEffect(() => {
    if (role === 'member') {
      navigate('/');
      return;
    }
    if (role === 'admin') {
      navigate('/admin');
      return;
    }
    loadTeamReadiness();
  }, [role]);

  const loadTeamReadiness = async () => {
    setLoading(true);
    try {
      const res = await getTeamReadiness();
      setTeamData(res.data || []);
    } catch {
      toast.error('Failed to load team readiness');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-4">📊</div>
          <p className="text-muted-foreground">Computing readiness scores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Review Readiness Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track which direct reports are ready for review season</p>
        </div>

        {teamData.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-4">👥</div>
            <h3 className="text-lg font-semibold mb-2">No direct reports</h3>
            <p className="text-muted-foreground text-sm">You don't have any direct reports assigned yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {teamData.map((member) => (
              <div key={member.employee_id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${scoreBg(member.score)} flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                    {member.employee_name?.[0] || '?'}
                  </div>

                  {/* Name & Score */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{member.employee_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 max-w-32 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${scoreBg(member.score)} transition-all duration-700`}
                          style={{ width: `${member.score}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">{member.score}%</span>
                    </div>
                  </div>

                  {/* Score Badge */}
                  <span className={`badge border px-3 py-1 text-sm font-bold ${scoreColor(member.score)}`}>
                    {member.score}/100
                  </span>

                  {/* Signal Icons */}
                  <div className="flex gap-1">
                    {member.signals?.map((signal, i) => (
                      <span key={i} title={signal.name} className={`text-lg ${signal.passed ? 'opacity-100' : 'opacity-20 grayscale'}`}>
                        {SIGNAL_ICONS[i]}
                      </span>
                    ))}
                  </div>

                  {/* Expand */}
                  {member.prompts?.length > 0 && (
                    <button
                      onClick={() => toggleExpanded(member.employee_id)}
                      className="text-muted-foreground hover:text-foreground transition-colors text-lg"
                    >
                      {expanded[member.employee_id] ? '▲' : '▼'}
                    </button>
                  )}
                </div>

                {/* Expanded Prompts */}
                {expanded[member.employee_id] && member.prompts?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    {!member.cycle_active && (
                      <p className="text-xs text-muted-foreground mb-2 italic">No active cycle — showing lifetime data</p>
                    )}
                    <ul className="space-y-2">
                      {member.prompts.map((prompt, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠</span>
                          <span className="text-foreground">{prompt.replace('⚠ Review deadline approaching — ', '')}</span>
                          {prompt.includes('⚠ Review deadline approaching') && (
                            <span className="badge bg-red-100 text-red-600 border-red-200 text-xs ml-auto flex-shrink-0">Deadline soon!</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {member.score === 100 && (
                  <div className="mt-3 pt-3 border-t border-border text-sm text-green-600 font-medium">
                    ✅ Review-ready — great work!
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
