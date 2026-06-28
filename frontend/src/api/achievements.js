import apiClient from './apiClient';

export const createAchievement = (data) => apiClient.post('/achievements/', data);
export const getAchievements = (params = {}) => apiClient.get('/achievements/', { params });

export default { createAchievement, getAchievements };
