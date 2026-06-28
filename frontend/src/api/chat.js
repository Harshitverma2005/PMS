import apiClient from './apiClient';

export const chatService = {
  chat: (message) => apiClient.post('/chat', { message }),
  clearContext: () => apiClient.post('/chat/clear')
};

export default chatService;
