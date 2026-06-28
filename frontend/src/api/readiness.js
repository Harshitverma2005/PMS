import apiClient from './apiClient';

export const getReadiness = (employeeId) => apiClient.get(`/readiness/${employeeId}`);
export const getTeamReadiness = () => apiClient.get('/readiness/team');

export default { getReadiness, getTeamReadiness };
