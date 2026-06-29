import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Zap, ChevronRight, AlertTriangle, Eye, EyeOff, Target, RefreshCw, Flag, Mail, Lock
} from "lucide-react";
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth';
import authService from '../api/auth';

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

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleLogin = async (e) => {
    e?.preventDefault?.();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await authService.login(email, password);
      setAuth(data);
      toast.success(`Welcome back, ${data.name}!`);
      navigate('/');
    } catch (err) {
      const msg = err.response?.status === 401
        ? "Invalid email or password"
        : (err.response?.data?.detail || "Login failed — is the backend running?");
      setError(typeof msg === 'string' ? msg : "Login failed");
      toast.error(typeof msg === 'string' ? msg : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: COLORS.bg, minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <style>{`
        .login-input:focus { outline: none; border-color: ${COLORS.accent} !important; box-shadow: 0 0 0 3px ${COLORS.accent}18; }
        .login-btn { transition: all 0.18s; cursor: pointer; border: none; font-family: inherit; }
        .login-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 8px 24px rgba(37,99,235,0.3) !important; }
        .login-btn:active { transform: translateY(0); }
        .show-btn { transition: all 0.15s; cursor: pointer; background: none; border: none; font-family: inherit; }
        .show-btn:hover { color: ${COLORS.text} !important; }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .fade-up { animation: fadeSlideUp 0.4s ease forwards; }
        .input-group { transition: all 0.2s ease; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 960, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)" }}>

        {/* Left panel — branding */}
        <div style={{
          background: `linear-gradient(145deg, #1e293b, #0f172a)`,
          padding: "52px 44px", display: "flex", flexDirection: "column",
          justifyContent: "space-between",
          position: "relative", overflow: "hidden",
        }}>
          {/* Background decoration */}
          <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
          <div style={{ position: "absolute", bottom: -40, left: -40, width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)" }} />

          {/* Logo */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={18} color="#fff" />
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                PMS
              </span>
            </div>

            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", lineHeight: 1.25, marginBottom: 14 }}>
                Performance &<br />Goal Management
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, maxWidth: 280 }}>
                A unified platform for goal tracking, probation monitoring, and performance reviews.
              </div>
              <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { icon: Target, label: "Goal cascade structure" },
                  { icon: RefreshCw, label: "Automated review cycles" },
                  { icon: Flag, label: "Strategic red flag detection" },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={13} color="rgba(255,255,255,0.8)" />
                      </div>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            © 2026 Apex PMS · v2.0 MVP
          </div>
        </div>

        {/* Right panel — login form */}
        <div style={{ background: COLORS.surface, padding: "52px 44px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <form onSubmit={handleLogin} className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, letterSpacing: "-0.03em", marginBottom: 6 }}>
                Welcome back
              </div>
              <div style={{ fontSize: 13, color: COLORS.muted }}>
                Sign in to your account to continue
              </div>
            </div>

            {/* Email */}
            <div className="input-group">
              <label style={{ fontSize: 12, fontWeight: 600, color: focusedField === 'email' ? COLORS.accent : COLORS.muted, display: "block", marginBottom: 7, letterSpacing: "0.03em", transition: "color 0.2s" }}>
                EMAIL ADDRESS
              </label>
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                  color: focusedField === 'email' ? COLORS.accent : COLORS.subtle,
                  transition: "color 0.2s", display: "flex", alignItems: "center",
                }}>
                  <Mail size={15} />
                </div>
                <input className="login-input"
                  type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    width: "100%", padding: "11px 14px 11px 40px",
                    border: `1.5px solid ${COLORS.border}`, borderRadius: 10,
                    fontSize: 13, color: COLORS.text, background: COLORS.bg,
                    fontFamily: "'DM Sans', sans-serif", transition: "border 0.15s, box-shadow 0.15s",
                  }}
                  placeholder="Enter your email"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="input-group">
              <label style={{ fontSize: 12, fontWeight: 600, color: focusedField === 'password' ? COLORS.accent : COLORS.muted, display: "block", marginBottom: 7, letterSpacing: "0.03em", transition: "color 0.2s" }}>
                PASSWORD
              </label>
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                  color: focusedField === 'password' ? COLORS.accent : COLORS.subtle,
                  transition: "color 0.2s", display: "flex", alignItems: "center",
                }}>
                  <Lock size={15} />
                </div>
                <input className="login-input"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    width: "100%", padding: "11px 42px 11px 40px",
                    border: `1.5px solid ${COLORS.border}`, borderRadius: 10,
                    fontSize: 13, color: COLORS.text, background: COLORS.bg,
                    fontFamily: "'DM Mono', monospace", transition: "border 0.15s, box-shadow 0.15s",
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button type="button" className="show-btn" onClick={() => setShowPass(!showPass)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: COLORS.muted, fontSize: 11, fontWeight: 600 }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: `${COLORS.rose}10`, border: `1px solid ${COLORS.rose}33`,
                borderRadius: 8, padding: "9px 12px",
                fontSize: 12, color: COLORS.rose, fontWeight: 500,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <AlertTriangle size={13} /> {error}
              </div>
            )}

            {/* Login button */}
            <button type="submit" className="login-btn" disabled={loading}
              style={{
                width: "100%", padding: "13px",
                background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDim})`,
                borderRadius: 11, fontSize: 14, fontWeight: 700, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 14px rgba(37,99,235,0.2)",
                opacity: loading ? 0.8 : 1,
                marginTop: 4,
              }}>
              {loading ? (
                <>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} />
                  Signing in…
                </>
              ) : (
                <>Sign in <ChevronRight size={15} /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
