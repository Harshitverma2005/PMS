import apiClient from './apiClient';

export const getReadiness = (employeeId) => apiClient.get(`/readiness/${employeeId}`);
export const getTeamReadiness = () => apiClient.get('/readiness/team');
export const sendNudge = (employeeId) => apiClient.post(`/readiness/${employeeId}/nudge`);

export default { getReadiness, getTeamReadiness, sendNudge };
