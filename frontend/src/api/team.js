import apiClient from './apiClient';
import API_ENDPOINTS from './apiEndpoints';

export const teamService = {
  getAll: () => apiClient.get(API_ENDPOINTS.TEAMS.BASE),
  getById: (id) => apiClient.get(API_ENDPOINTS.TEAMS.BY_ID(id)),
  create: (data) => apiClient.post(API_ENDPOINTS.TEAMS.BASE, data),
  update: (id, data) => apiClient.patch(API_ENDPOINTS.TEAMS.BY_ID(id), data),
  delete: (id) => apiClient.delete(API_ENDPOINTS.TEAMS.BY_ID(id))
};

export default teamService;
