import apiClient from './apiClient';

export const getTimeline = (employeeId, params = {}) =>
  apiClient.get(`/timeline/${employeeId}`, { params });

export const exportTimeline = async (employeeId, params = {}) => {
  const response = await apiClient.get(`/timeline/${employeeId}/export`, {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url;
  const today = new Date().toISOString().split('T')[0];
  a.download = `timeline_${employeeId}_${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export default { getTimeline, exportTimeline };
