import apiClient from './apiClient';

export const generateDraft = async (formId) => {
  try {
    const response = await apiClient.post(`/reviews/forms/${formId}/draft`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 503) {
      throw new Error('Draft generation temporarily unavailable; please try again');
    }
    throw error;
  }
};

export default { generateDraft };
