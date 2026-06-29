import { create } from 'zustand';
import authService from '../api/auth';

// Normalize the backend login payload into a stable user object.
// Backend returns: { access_token, token_type, user_id, email, name, role, team_id, manager_id }
function normalizeUser(raw) {
  if (!raw) return null;
  return {
    id: raw.user_id ?? raw.id,
    user_id: raw.user_id ?? raw.id,
    name: raw.name,
    email: raw.email,
    role: raw.role,            // 'admin' | 'manager' | 'member'
    team_id: raw.team_id ?? null,
    manager_id: raw.manager_id ?? null,
  };
}

const storedToken = localStorage.getItem('token');
const storedUser = authService.getCurrentUser();

export const useAuthStore = create((set, get) => ({
  user: normalizeUser(storedUser),
  token: storedToken || null,
  isAuthenticated: !!storedToken,

  // Accepts the raw backend login response (also persists token + user via authService.login).
  setAuth: (loginResponse) => {
    set({
      user: normalizeUser(loginResponse),
      token: loginResponse.access_token,
      isAuthenticated: true,
    });
  },

  logout: () => {
    authService.logout();
    set({ user: null, token: null, isAuthenticated: false });
  },

  isAdmin: () => get().user?.role === 'admin',
  isManager: () => ['admin', 'manager'].includes(get().user?.role),
}));
