import apiClient from './apiClient';

export const createKudos = (data) => apiClient.post('/kudos/', data);
export const getKudosFeed = (page = 1) =>
  apiClient.get('/kudos/feed', { params: { page, page_size: 50 } });

export default { createKudos, getKudosFeed };
