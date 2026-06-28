import apiClient from './apiClient';

export const exportReview = async (formId) => {
  try {
    const response = await apiClient.get(`/reviews/forms/${formId}/export`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    // Extract filename from Content-Disposition header if available
    const disposition = response.headers['content-disposition'] || '';
    const match = disposition.match(/filename="([^"]+)"/);
    a.download = match ? match[1] : 'review_export.html';
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error('Export failed — please try again');
  }
};

export default { exportReview };
