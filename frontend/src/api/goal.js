import apiClient from './apiClient';
import API_ENDPOINTS from './apiEndpoints';

export const goalService = {
  getAll: (params) => apiClient.get(API_ENDPOINTS.GOALS.BASE, { params }),
  getById: (id) => apiClient.get(API_ENDPOINTS.GOALS.BY_ID(id)),
  create: (data) => apiClient.post(API_ENDPOINTS.GOALS.BASE, data),
  update: (id, data) => apiClient.patch(API_ENDPOINTS.GOALS.BY_ID(id), data),
  delete: (id) => apiClient.delete(API_ENDPOINTS.GOALS.ARCHIVE(id)),
  submit: (id) => apiClient.post(API_ENDPOINTS.GOALS.SUBMIT(id)),
  approve: (id, comment = 'Approved') => 
    apiClient.post(API_ENDPOINTS.GOALS.APPROVE(id), { approved: true, comment }),
  reject: (id, comment) => 
    apiClient.post(API_ENDPOINTS.GOALS.APPROVE(id), { approved: false, comment }),
  archive: (id, reason) =>
    apiClient.post(API_ENDPOINTS.GOALS.ARCHIVE(id), { archive_reason: reason }),
  getHistory: (id) => apiClient.get(API_ENDPOINTS.GOALS.HISTORY(id)),
  updateProgress: (id, percentage) => 
    apiClient.post(API_ENDPOINTS.GOALS.PROGRESS(id), { completion_percentage: percentage }),
  
  // Subtasks
  addSubtask: (goalId, data) => apiClient.post(API_ENDPOINTS.GOALS.SUBTASKS(goalId), data),
  updateSubtask: (goalId, subtaskId, data) => apiClient.patch(`goals/subtasks/${subtaskId}`, data),
  deleteSubtask: (goalId, subtaskId) => apiClient.delete(`goals/${goalId}/subtasks/${subtaskId}`),
  
  // Feedback
  submitFeedback: (id, data) => {
    const url = data.feedback_type === 'member' 
      ? API_ENDPOINTS.GOALS.MEMBER_FEEDBACK(id)
      : API_ENDPOINTS.GOALS.EVALUATOR_FEEDBACK(id);
    return apiClient.post(url, data);
  },
  
  // Score
  submitScore: (id, data) => apiClient.post(API_ENDPOINTS.GOALS.SCORING(id), data),
  
  // Weightage
  checkWeightage: (userId, tag) => apiClient.get(API_ENDPOINTS.USERS.WEIGHTAGE(userId, tag))
};

export default goalService;
