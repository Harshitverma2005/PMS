import api from './api';

export const chatService = {
  chat: (message) => api.post('/chat', { message }),
  clearContext: () => api.post('/chat/clear')
};
