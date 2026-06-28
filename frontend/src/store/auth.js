import { create } from 'zustand';
import { chatService } from '../api/chat';

export const useAuthStore = create((set) => ({
  user: (() => {
    const user = localStorage.getItem('user');
    return user && user !== 'undefined' ? JSON.parse(user) : null;
  })(),
  token: localStorage.getItem('token'),
  
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },
  
  logout: async () => {
    try {
      if (localStorage.getItem('token')) {
        await chatService.clearContext();
      }
    } catch (e) {
      console.error("Failed to clear chat context on logout", e);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
  
  isAdmin: () => {
    const state = useAuthStore.getState();
    return state.user?.role === 'admin';
  },
  
  isManager: () => {
    const state = useAuthStore.getState();
    return state.user?.role === 'manager' || state.user?.role === 'admin';
  }
}));
