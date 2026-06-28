import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  CheckCircle, XCircle, Plus, Trash2, Edit, 
  Target, Clock, AlertTriangle, Shield, 
  ArrowLeft, ChevronRight, Zap, MessageSquare, 
  Activity, Award, FileText,
  Calendar,
  ClipboardList
} from 'lucide-react';
import Layout from '../components/Layout';
import { goalService, userService } from '../api';
import { 
  GoalStatus, FeedbackType, PerformanceRating, 
  GoalLevel, GoalTag, GoalPriority, PRIORITY_WEIGHTAGE 
} from '../constants/enums';
import { formatDate, formatEnumValue } from '../utils/format';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

const COLORS = {
  bg: "#F5F4F0",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E4E2DC",
  accent: "#2563EB",
  accentDim: "#1D4ED8",
  emerald: "#059669",
  amber: "#D97706",
  rose: "#DC2626",
  violet: "#7C3AED",
  text: "#111111",
  muted: "#6B7280",
  subtle: "#9CA3AF",
};

export default function GoalDetail() {
  const { id } = useParams();
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);
  const [showInterventionModal, setShowInterventionModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [history, setHistory] = useState([]);
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadGoal();
  }, [id]);

  const loadGoal = async () => {
    try {
      const [goalRes, histRes] = await Promise.all([
        goalService.getById(id),
        goalService.getHistory(id).catch(() => ({ data: [] }))
      ]);
      setGoal(goalRes.data);
      setHistory(histRes.data || []);
    } catch (error) {
      toast.error('Strategic objective not found');
      navigate('/goals');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSubmit = async (comment) => {
    try {
      await goalService.approve(id, comment);
      toast.success('Strategy approved');
      loadGoal();
      setShowApproveModal(false);
    } catch (error) {
      toast.error('Approval failed');
    }
  };

  const handleReject = async () => {
    setShowInterventionModal(true);
  };

  const handleInterventionSubmit = async (reason) => {
    try {
      await goalService.reject(id, reason);
      toast.success('Intervention recorded');
      loadGoal();
      setShowInterventionModal(false);
    } catch (error) {
      toast.error('Rejection failed');
    }
  };

  const handleArchiveSubmit = async (reason) => {
    try {
      await goalService.archive(id, reason);
      toast.success('Objective archived');
      loadGoal();
      setShowArchiveModal(false);
    } catch (error) {
      toast.error('Archive failed');
    }
  };

  const handleSubmit = async () => {
    try {
      await goalService.submit(id);
      toast.success('Deployed for approval');
      loadGoal();
    } catch (error) {
      toast.error('Deployment failed');
    }
  };

  const handleComplete = async () => {
    try {
      await goalService.complete(id);
      toast.success('Execution complete');
      loadGoal();
    } catch (error) {
      toast.error('Completion failed');
    }
  };

  if (loading) return (
    <Layout>
      <div style={{ height: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.accent, animation: "spin 1s linear infinite" }} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );

  const role = currentUser?.role?.toString().toLowerCase().split('.').pop() || '';
  const isAssignee = goal?.assignee_id === currentUser?.id;
  
  // Only Managers and Admins can approve if not their own goal
  const canApprove = (role === 'admin' || role === 'manager') && !isAssignee;
  const isCreator = goal?.creator_id === currentUser?.id;
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        
        {/* Breadcrumb & Navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
             <button onClick={() => navigate(-1)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: 8, borderRadius: 10, cursor: "pointer", color: COLORS.muted }}>
                <ArrowLeft size={16} />
             </button>
             <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: COLORS.muted }}>
                <Link to="/goals" style={{ textDecoration: "none", color: "inherit" }}>Strategic Pipeline</Link>
                <ChevronRight size={14} />
                <span style={{ color: COLORS.text }}>OBJ-{id}</span>
             </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {(goal.status === GoalStatus.DRAFT || goal.status === GoalStatus.REJECTED || (goal.status === GoalStatus.PENDING_APPROVAL && !canApprove)) && (isAssignee || isCreator) && (
              <>
                <button onClick={() => setShowEditModal(true)} style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.border}`, padding: "10px 20px", borderRadius: 10, color: COLORS.text, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                   <Edit size={16} /> Edit Objective
                </button>
                {goal.status !== GoalStatus.PENDING_APPROVAL && (
                  <button onClick={handleSubmit} style={{ background: COLORS.accent, border: "none", padding: "10px 20px", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Submit for Approval</button>
                )}
              </>
            )}
            {goal.status === GoalStatus.PENDING_APPROVAL && canApprove && (
              <>
                <button onClick={() => setShowApproveModal(true)} style={{ background: COLORS.emerald, border: "none", padding: "10px 20px", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Approve Strategy</button>
                <button onClick={handleReject} style={{ background: COLORS.rose, border: "none", padding: "10px 20px", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Intervene / Reject</button>
              </>
            )}
            {(isAssignee || isManager || isAdmin) && goal.status !== 'archived' && (
              <button onClick={() => setShowArchiveModal(true)} style={{ background: COLORS.bg, border: `1.5px solid ${COLORS.border}`, padding: "10px 20px", borderRadius: 10, color: COLORS.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Archive</button>
            )}
            {goal.status === GoalStatus.ACTIVE && (isAssignee || canApprove) && (
              <>
                <button onClick={() => setShowProgressModal(true)} style={{ background: COLORS.accent, border: "none", padding: "10px 20px", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Action Progress</button>
                {goal.completion_percentage === 100 ? (
                   <button onClick={handleComplete} style={{ background: COLORS.emerald, border: "none", padding: "10px 20px", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: `0 4px 12px ${COLORS.emerald}40` }}>Finalize Objective</button>
                ) : (
                   <button onClick={handleComplete} style={{ background: COLORS.bg, border: `1.5px solid ${COLORS.border}`, padding: "10px 20px", borderRadius: 10, color: COLORS.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Mark Completed</button>
                )}
              </>
            )}
            {goal.status === GoalStatus.AWAITING_FEEDBACK && isAssignee && !goal.feedbacks?.some(f => f.feedback_type === FeedbackType.EMPLOYEE) && (
               <button onClick={() => navigate('/performance')} style={{ background: COLORS.violet, border: "none", padding: "10px 20px", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: `0 4px 12px ${COLORS.violet}40` }}>Submit Self-Reflection</button>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Header Card */}
            <div style={{
              background: COLORS.card, border: `1.5px solid ${COLORS.border}`,
              borderRadius: 24, padding: 32, display: "flex", flexDirection: "column", gap: 20,
              boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
            }}>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                     <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: COLORS.text, letterSpacing: "-0.04em" }}>{goal.title}</h1>
                        <div style={{
                           padding: "4px 12px", borderRadius: 6,
                           background: goal.status === GoalStatus.ACTIVE ? `${COLORS.accent}12` : `${COLORS.muted}12`,
                           color: goal.status === GoalStatus.ACTIVE ? COLORS.accent : COLORS.muted,
                           fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                        }}>
                           {formatEnumValue(goal.status)}
                        </div>
                     </div>
                     <p style={{ fontSize: 15, color: COLORS.muted, lineHeight: 1.6, maxWidth: "90%" }}>{goal.description || "No strategic narrative provided for this objective."}</p>
                  </div>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: `${COLORS.accent}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                     <Target size={24} color={COLORS.accent} />
                  </div>
               </div>

               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, paddingTop: 24, borderTop: `1px solid ${COLORS.border}` }}>
                  {[
                    { label: "Execution Velocity", value: `${goal.completion_percentage}%`, icon: Activity, color: COLORS.accent },
                    { label: "Time Elapsed", value: `${goal.time_elapsed_percentage}%`, icon: Clock, color: COLORS.amber },
                    { label: "Strategic Weightage", value: `${goal.weightage}%`, icon: Award, color: COLORS.violet },
                  ].map((m, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                       <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <m.icon size={14} color={COLORS.subtle} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>{m.label}</span>
                       </div>
                       <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.text }}>{m.value}</div>
                       <div style={{ width: "100%", height: 5, background: COLORS.bg, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ width: m.value, height: "100%", background: m.color, borderRadius: 10 }} />
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Subtasks */}
            <SubtasksSection goal={goal} loadGoal={loadGoal} isAssignee={isAssignee} />

            {/* History Timeline */}
            {history && history.length > 0 && (
              <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 24, padding: 32, display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>Status History</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {history.map((item, i) => (
                    <div key={item.id || i} style={{ display: "flex", gap: 16, position: "relative" }}>
                      {i !== history.length - 1 && <div style={{ position: "absolute", left: 11, top: 24, bottom: -16, width: 2, background: COLORS.border }} />}
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${COLORS.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, marginTop: 2 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.accent }} />
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, background: COLORS.bg, padding: 16, borderRadius: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                           <div>
                             <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{item.actor_name}</span>
                             <span style={{ fontSize: 13, color: COLORS.muted }}> changed status to </span>
                             <StatusPill status={item.to_status} size="sm" />
                           </div>
                           <span style={{ fontSize: 11, color: COLORS.subtle }}>{formatDate(item.timestamp)}</span>
                        </div>
                        {item.comment && (
                           <div style={{ fontSize: 13, color: COLORS.text, background: "#fff", padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontStyle: "italic", marginTop: 4 }}>
                             "{item.comment}"
                           </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback & Scoring */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
               <FeedbackSection goal={goal} loadGoal={loadGoal} currentUser={currentUser} />
               <ScoreSection goal={goal} loadGoal={loadGoal} canScore={canApprove} />
            </div>
          </div>

          {/* Sidebar Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
             {/* Risk Card */}
             {goal.is_at_risk && (
               <div style={{
                 background: `${COLORS.rose}08`, border: `1.5px solid ${COLORS.rose}30`,
                 borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 12,
               }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, color: COLORS.rose }}>
                     <AlertTriangle size={18} />
                     <span style={{ fontSize: 14, fontWeight: 800 }}>Detected Risk Flag</span>
                  </div>
                  <p style={{ fontSize: 12, color: COLORS.rose, fontWeight: 500, lineHeight: 1.5 }}>
                     Progress is below the 50% threshold despite 70% time elapsed. Administrative intervention suggested.
                  </p>
               </div>
             )}

             {/* Meta Card */}
             <div style={{
               background: COLORS.card, border: `1.5px solid ${COLORS.border}`,
               borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 20,
             }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>Objective Metadata</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                   {[
                     { label: "Pipeline Level", value: goal.level, icon: Target },
                     { label: "Classification", value: goal.tag, icon: Award },
                     { label: "Deployment Date", value: formatDate(goal.start_date), icon: Calendar },
                     { label: "Target Deadline", value: formatDate(goal.due_date), icon: Clock },
                   ].map((item, i) => (
                     <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                           <item.icon size={14} color={COLORS.subtle} />
                           <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted }}>{item.label}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, textTransform: "capitalize" }}>{item.value}</span>
                     </div>
                   ))}
                </div>

                <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 20, marginTop: 4, display: "flex", flexDirection: "column", gap: 16 }}>
                   <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.subtle, textTransform: "uppercase" }}>Strategic Owner</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                         <div style={{ width: 28, height: 28, borderRadius: 8, background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: COLORS.muted }}>{goal.owner?.name?.charAt(0)}</div>
                         <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{goal.owner?.name}</span>
                            <span style={{ fontSize: 11, color: COLORS.muted }}>{goal.owner?.department}</span>
                         </div>
                      </div>
                   </div>
                   <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.subtle, textTransform: "uppercase" }}>Created By</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                         <div style={{ width: 28, height: 28, borderRadius: 8, background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: COLORS.muted }}>{goal.creator?.name?.charAt(0)}</div>
                         <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{goal.creator?.name}</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {showProgressModal && (
          <ProgressModal goal={goal} onClose={() => setShowProgressModal(false)} onSuccess={loadGoal} />
        )}

        {showApproveModal && (
          <InterventionModal 
             title="Approve Strategy" 
             subtitle="Add an approval note (required)." 
             onClose={() => setShowApproveModal(false)} 
             onSubmit={handleApproveSubmit} 
             buttonText="Approve" 
             buttonColor={COLORS.emerald}
          />
        )}

        {showInterventionModal && (
          <InterventionModal 
             title="Intervention Rationale" 
             subtitle="Explain the reason for this administrative intervention." 
             onClose={() => setShowInterventionModal(false)} 
             onSubmit={handleInterventionSubmit}
             buttonText="Confirm Intervention"
             buttonColor={COLORS.rose}
          />
        )}

        {showArchiveModal && (
          <InterventionModal 
             title="Archive Objective" 
             subtitle="Provide a reason for archiving this objective." 
             onClose={() => setShowArchiveModal(false)} 
             onSubmit={handleArchiveSubmit}
             buttonText="Archive"
             buttonColor={COLORS.muted}
          />
        )}

        {showEditModal && (
          <EditGoalModal goal={goal} onClose={() => setShowEditModal(false)} onSuccess={loadGoal} />
        )}
      </div>
    </Layout>
  );
}

function EditGoalModal({ goal, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    title: goal.title,
    description: goal.description || '',
    level: goal.level,
    tag: goal.tag,
    priority: goal.priority,
    start_date: goal.start_date,
    assignee_id: goal.assignee_id,
  });
  const [subtasks, setSubtasks] = useState(goal.subtasks || []);
  const [newSubtask, setNewSubtask] = useState({ title: '', weightage: 0 });
  const [users, setUsers] = useState([]);
  const [processing, setProcessing] = useState(false);
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await userService.getAll();
      setUsers(response.data);
    } catch (e) { toast.error('Failed to load user list'); }
  };

  const handleAddSubtask = () => {
    if (!newSubtask.title) return;
    setSubtasks([...subtasks, { ...newSubtask }]);
    setNewSubtask({ title: '', weightage: 0 });
  };

  const handleRemoveSubtask = (idx) => {
    setSubtasks(subtasks.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      await goalService.update(goal.id, {
        ...formData,
        subtasks: subtasks.map(s => ({ title: s.title, weightage: s.weightage }))
      });
      toast.success('Objective recalibrated');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Update failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
       <div style={{ background: "#fff", padding: 32, borderRadius: 24, width: 550, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
             <div style={{ fontSize: 20, fontWeight: 900 }}>Edit Strategic Objective</div>
             <p style={{ fontSize: 13, color: COLORS.muted }}>Modify the fundamental parameters and milestones of this objective.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
             <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.subtle, textTransform: "uppercase" }}>Strategic Title</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required
                   style={{ padding: "12px", border: `1.5px solid ${COLORS.border}`, borderRadius: 12, fontSize: 14, outline: "none" }} />
             </div>

             <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.subtle, textTransform: "uppercase" }}>Narrative Description</label>
                <textarea rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                   style={{ padding: "12px", border: `1.5px solid ${COLORS.border}`, borderRadius: 12, fontSize: 14, outline: "none", resize: "none" }} />
             </div>

             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                   <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.subtle, textTransform: "uppercase" }}>Level</label>
                   <select value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})} style={{ padding: 12, borderRadius: 12, border: `1.5px solid ${COLORS.border}` }}>
                      {Object.values(GoalLevel).map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                   </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                   <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.subtle, textTransform: "uppercase" }}>Classification</label>
                   <select value={formData.tag} onChange={e => setFormData({...formData, tag: e.target.value})} style={{ padding: 12, borderRadius: 12, border: `1.5px solid ${COLORS.border}` }}>
                      {Object.values(GoalTag).map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                   </select>
                </div>
             </div>

             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                   <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.subtle, textTransform: "uppercase" }}>Priority</label>
                   <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} style={{ padding: 12, borderRadius: 12, border: `1.5px solid ${COLORS.border}` }}>
                      {Object.entries(PRIORITY_WEIGHTAGE).map(([p, w]) => <option key={p} value={p}>{p.toUpperCase()} ({w}%)</option>)}
                   </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                   <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.subtle, textTransform: "uppercase" }}>Start Date</label>
                   <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})}
                      style={{ padding: 12, borderRadius: 12, border: `1.5px solid ${COLORS.border}` }} />
                </div>
             </div>

             {/* Subtasks Section In Edit */}
             <div style={{ background: COLORS.bg, padding: 20, borderRadius: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                   <ClipboardList size={16} color={COLORS.accent} />
                   <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.text, textTransform: "uppercase" }}>Tactical Milestones</span>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                   {subtasks.map((st, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", padding: "8px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
                         <span style={{ fontSize: 13, fontWeight: 600 }}>{st.title}</span>
                         <button type="button" onClick={() => handleRemoveSubtask(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.rose }}>
                            <XCircle size={14} />
                         </button>
                      </div>
                   ))}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                   <input type="text" placeholder="New milestone..." value={newSubtask.title} onChange={e => setNewSubtask({...newSubtask, title: e.target.value})}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }} />
                   <button type="button" onClick={handleAddSubtask} style={{ padding: "8px 16px", borderRadius: 8, background: COLORS.accent, color: "#fff", border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Add</button>
                </div>
             </div>

             {currentUser.role !== 'member' && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                   <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.subtle, textTransform: "uppercase" }}>Strategic Owner</label>
                   <select value={formData.assignee_id} onChange={e => setFormData({...formData, assignee_id: Number(e.target.value)})} style={{ padding: 12, borderRadius: 12, border: `1.5px solid ${COLORS.border}` }}>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                   </select>
                </div>
             )}

             <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1.5px solid ${COLORS.border}`, background: "#fff", fontWeight: 700, cursor: "pointer" }}>Dismiss</button>
                <button type="submit" disabled={processing} style={{ flex: 2, padding: 12, borderRadius: 12, border: "none", background: COLORS.accent, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                   {processing ? "Saving Changes..." : "Commit Update"}
                </button>
             </div>
          </form>
       </div>
    </div>
  );
}

function SubtasksSection({ goal, loadGoal, isAssignee }) {
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleAdd = async () => {
    if (!title) return;
    setProcessing(true);
    try {
      await goalService.addSubtask(goal.id, { title, description: "" });
      toast.success('Milestone added');
      setTitle('');
      setShowModal(false);
      loadGoal();
    } catch (error) {
       toast.error('Failed to add milestone');
    } finally {
       setProcessing(false);
    }
  };

  const handleToggle = async (subtask) => {
    try {
      await goalService.updateSubtask(goal.id, subtask.id, { is_completed: !subtask.is_completed });
      loadGoal();
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const handleDelete = async (subtaskId) => {
    if (!confirm("Remove this milestone?")) return;
    try {
      await goalService.deleteSubtask(goal.id, subtaskId);
      toast.success('Milestone removed');
      loadGoal();
    } catch (error) {
       toast.error('Failed to remove milestone');
    }
  };

  return (
    <div style={{
      background: COLORS.card, border: `1.5px solid ${COLORS.border}`,
      borderRadius: 24, padding: 32, display: "flex", flexDirection: "column", gap: 20,
    }}>
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
             <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>Tactical Milestones</div>
             <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>Granular sub-objectives required for success</div>
          </div>
        
            <button onClick={() => setShowModal(true)} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, color: COLORS.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
               <Plus size={14} /> Add Milestone
            </button>
       </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {goal.subtasks?.map((subtask) => (
            <div key={subtask.id} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "16px", background: COLORS.bg, borderRadius: 14,
              opacity: subtask.is_completed ? 0.6 : 1, transition: "all 0.2s",
              border: `1px solid transparent`,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.border}
            onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
            >
               <input type="checkbox" checked={subtask.is_completed} onChange={() => handleToggle(subtask)} disabled={!isAssignee}
                 style={{ width: 18, height: 18, borderRadius: 4, cursor: isAssignee ? "pointer" : "default", accentColor: COLORS.emerald }} />
               <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: COLORS.text, textDecoration: subtask.is_completed ? "line-through" : "none" }}>{subtask.title}</div>
               <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                 {subtask.is_completed && <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.emerald, background: `${COLORS.emerald}12`, padding: "2px 8px", borderRadius: 4 }}>COMPLETED</div>}
                 {isAssignee && (
                   <button onClick={() => handleDelete(subtask.id)} style={{ background: "none", border: "none", color: COLORS.subtle, cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }} title="Delete">
                      <Trash2 size={14} />
                   </button>
                 )}
               </div>
            </div>
          ))}
          {(!goal.subtasks || goal.subtasks.length === 0) && (
             <div style={{ textAlign: "center", padding: 32, color: COLORS.subtle, fontSize: 13, border: `1px dashed ${COLORS.border}`, borderRadius: 16 }}>No milestones defined for this strategy.</div>
          )}
       </div>

       {showModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
             <div style={{ background: "#fff", padding: 24, borderRadius: 20, width: 340, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>New Milestone</div>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Milestone title..."
                  style={{ padding: "10px 14px", border: `1.5px solid ${COLORS.border}`, borderRadius: 10, fontSize: 13, outline: "none" }} />
                <div style={{ display: "flex", gap: 10 }}>
                   <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${COLORS.border}`, background: "#fff", fontWeight: 700, cursor: "pointer" }}>Back</button>
                   <button onClick={handleAdd} disabled={processing} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: COLORS.accent, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Confirm</button>
                </div>
             </div>
          </div>
       )}
    </div>
  );
}

function ProgressModal({ goal, onClose, onSuccess }) {
  const [percentage, setPercentage] = useState(goal.completion_percentage);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async () => {
    setProcessing(true);
    try {
      await goalService.updateProgress(goal.id, percentage);
      toast.success('Velocity updated');
      onSuccess();
      onClose();
    } catch (error) {
       toast.error('Update failed');
    } finally {
       setProcessing(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
       <div style={{ background: "#fff", padding: 32, borderRadius: 24, width: 380, display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
             <div style={{ fontSize: 18, fontWeight: 800 }}>Strategic Progress</div>
             <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>Update the current execution velocity for this objective.</p>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
             <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800 }}>
                <span>Completion</span>
                <span style={{ color: COLORS.accent }}>{percentage}%</span>
             </div>
             <input type="range" min="0" max="100" value={percentage} onChange={e => setPercentage(Number(e.target.value))} style={{ width: "100%", height: 6, background: COLORS.bg, borderRadius: 10 }} />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
             <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1.5px solid ${COLORS.border}`, background: "#fff", color: COLORS.muted, fontWeight: 700, cursor: "pointer" }}>Dismiss</button>
             <button onClick={handleSubmit} disabled={processing} style={{ flex: 2, padding: 12, borderRadius: 12, border: "none", background: COLORS.accent, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Confirm & Commit</button>
          </div>
       </div>
    </div>
  );
}

function FeedbackSection({ goal, loadGoal, currentUser }) {
  const employeeFeedback = goal.feedbacks?.find(f => f.feedback_type === FeedbackType.EMPLOYEE);
  const evaluatorFeedback = goal.feedbacks?.find(f => f.feedback_type === FeedbackType.EVALUATOR);

  return (
    <div style={{
      background: COLORS.card, border: `1.5px solid ${COLORS.border}`,
      borderRadius: 24, padding: 32, display: "flex", flexDirection: "column", gap: 20,
    }}>
       <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>Strategic Feedback</div>
       
       <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {employeeFeedback && (
            <div style={{ padding: "16px", background: COLORS.bg, borderRadius: 16, borderLeft: `3px solid ${COLORS.accent}` }}>
               <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.accent, textTransform: "uppercase" }}>Member Reflection</div>
               <div style={{ fontSize: 13, color: COLORS.text, marginTop: 8, lineHeight: 1.5 }}>{employeeFeedback.deliverables}</div>
            </div>
          )}
          {evaluatorFeedback && (
            <div style={{ padding: "16px", background: COLORS.bg, borderRadius: 16, borderLeft: `3px solid ${COLORS.violet}` }}>
               <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.violet, textTransform: "uppercase" }}>Evaluator Rating</div>
               <div style={{ fontSize: 13, color: COLORS.text, marginTop: 8, lineHeight: 1.5 }}>{evaluatorFeedback.evaluator_comment}</div>
            </div>
          )}
          {!employeeFeedback && !evaluatorFeedback && (
            <div style={{ textAlign: "center", padding: 24, border: `1.5px dashed ${COLORS.border}`, borderRadius: 16, color: COLORS.subtle, fontSize: 13, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
               <span>No feedback entries detected.</span>
               {goal.status === GoalStatus.AWAITING_FEEDBACK && currentUser?.id === goal.owner_id && (
                 <button onClick={() => navigate('/performance')} style={{ background: COLORS.accent, color: "#fff", border: "none", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Open Feedback Window</button>
               )}
            </div>
          )}
       </div>
    </div>
  );
}

function ScoreSection({ goal, loadGoal, canScore }) {
  return (
    <div style={{
      background: COLORS.card, border: `1.5px solid ${COLORS.border}`,
      borderRadius: 24, padding: 32, display: "flex", flexDirection: "column", gap: 20,
    }}>
       <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>Final Grading</div>
       
       {goal.score ? (
         <div style={{ padding: 24, background: `${COLORS.emerald}08`, borderRadius: 16, border: `1px solid ${COLORS.emerald}30`, textAlign: "center" }}>
            <Award size={32} color={COLORS.emerald} style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text, textTransform: "capitalize" }}>{formatEnumValue(goal.score.rating)}</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>Scored by {goal.score.scored_by?.name} on {formatDate(goal.score.scored_at)}</div>
         </div>
       ) : (
         <div style={{ textAlign: "center", padding: 24, border: `1.5px dashed ${COLORS.border}`, borderRadius: 16, color: COLORS.subtle, fontSize: 13 }}>Waiting for evaluation phase.</div>
       )}
    </div>
  );
}

function StatusPill({ status, size = "sm" }) {
  const config = {
    [GoalStatus.DRAFT]: { bg: `${COLORS.subtle}18`, text: COLORS.muted, label: "Draft" },
    [GoalStatus.ACTIVE]: { bg: `${COLORS.accent}12`, text: COLORS.accent, label: "Active" },
    [GoalStatus.COMPLETED]: { bg: `${COLORS.emerald}12`, text: COLORS.emerald, label: "Completed" },
    [GoalStatus.PENDING_APPROVAL]: { bg: `${COLORS.amber}12`, text: COLORS.amber, label: "Pending Approval" },
    [GoalStatus.AWAITING_FEEDBACK]: { bg: `${COLORS.violet}12`, text: COLORS.violet, label: "Awaiting Feedback" },
    [GoalStatus.SCORED]: { bg: `${COLORS.emerald}24`, text: COLORS.emerald, label: "Scored" },
    [GoalStatus.REJECTED]: { bg: `${COLORS.rose}12`, text: COLORS.rose, label: "Rejected" },
    "archived": { bg: `${COLORS.subtle}18`, text: COLORS.muted, label: "Archived" },
  };
  const c = config[status] || { bg: COLORS.bg, text: COLORS.muted, label: status || "—" };
  const pad = size === "sm" ? "3px 8px" : "4px 12px";
  const fs = size === "sm" ? 10 : 11;
  return (
    <div style={{
      display: "inline-flex", padding: pad, borderRadius: 6,
      background: c.bg, color: c.text,
      fontSize: fs, fontWeight: 700, letterSpacing: "-0.01em",
      whiteSpace: "nowrap",
    }}>
      {c.label}
    </div>
  );
}

function InterventionModal({ title, subtitle, onClose, onSubmit, buttonText, buttonColor }) {
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a rationale/comment");
      return;
    }
    setProcessing(true);
    await onSubmit(reason);
    setProcessing(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
       <div style={{ background: "#fff", padding: 32, borderRadius: 24, width: 440, display: "flex", flexDirection: "column", gap: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.12)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
             <div style={{ width: 44, height: 44, borderRadius: 12, background: `${buttonColor}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield size={22} color={buttonColor} />
             </div>
             <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{title}</div>
                <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>{subtitle}</p>
             </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
             <label style={{ fontSize: 11, fontWeight: 800, color: COLORS.subtle, textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</label>
             <textarea rows="5" value={reason} onChange={e => setReason(e.target.value)} placeholder="Enter details here..."
               style={{ 
                 width: "100%", padding: "14px", border: `1.5px solid ${COLORS.border}`, borderRadius: 14, 
                 fontSize: 14, outline: "none", background: COLORS.bg, resize: "none",
                 fontFamily: "inherit", lineHeight: 1.5, transition: "border 0.2s",
               }} 
               onFocus={e => e.target.style.borderColor = buttonColor}
               onBlur={e => e.target.style.borderColor = COLORS.border}
             />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
             <button onClick={onClose} style={{ flex: 1, padding: 14, borderRadius: 12, border: `1.5px solid ${COLORS.border}`, background: "#fff", color: COLORS.muted, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>Cancel</button>
             <button onClick={handleSubmit} disabled={processing} 
               style={{ 
                 flex: 1.5, padding: 14, borderRadius: 12, border: "none", 
                 background: buttonColor, color: "#fff", fontWeight: 700, cursor: "pointer", 
                 display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                 opacity: processing ? 0.7 : 1, transition: "all 0.2s",
                 boxShadow: `0 4px 12px ${buttonColor}33`,
               }}>
               {processing ? "Saving..." : buttonText}
             </button>
          </div>
       </div>
    </div>
  );
}
