export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/v1/auth/login',
  },
  GOALS: {
    BASE: '/v1/goals/',
    BY_ID: id => `/v1/goals/${id}`,
    SUBMIT: id => `/v1/goals/${id}/submit`,
    APPROVE: id => `/v1/goals/${id}/approve`,
    PROGRESS: id => `/v1/goals/${id}/progress`,
    SUBTASKS: id => `/v1/goals/${id}/subtasks`,
    SCORING: id => `/v1/goals/${id}/score`,
    MEMBER_FEEDBACK: id => `/v1/goals/${id}/feedback/member`,
    EVALUATOR_FEEDBACK: id => `/v1/goals/${id}/feedback/evaluator`,
    ARCHIVE: id => `/v1/goals/${id}/archive`,
  },
  USERS: {
    BASE: '/v1/users/',
    BY_ID: id => `/v1/users/${id}`,
    WEIGHTAGE: (userId, tag) => `/v1/users/${userId}/weightage/${tag}`,
  },
  TEAMS: {
    BASE: '/v1/teams/',
    BY_ID: id => `/v1/teams/${id}`,
  },
  CYCLES: {
    BASE: '/v1/review-cycles/',
    BY_ID: id => `/v1/review-cycles/${id}`,
    TRIGGER: id => `/v1/review-cycles/${id}/trigger`,
    CLOSE: id => `/v1/review-cycles/${id}/close`,
    COMPLIANCE: id => `/v1/review-cycles/${id}/compliance`,
  },
  FEEDBACK: {
    BASE: '/v1/review-forms/',
    BY_ID: id => `/v1/review-forms/${id}`,
    SUBMIT: id => `/v1/review-forms/${id}/submit`,
    FLAGS: '/v1/admin/flags/triage',
    FLAG_DETAIL: id => `/v1/admin/flags/${id}/review`,
  },
  PROBATION: {
    BASE: '/v1/probation/',
    ME: (userId) => `/v1/probation/employee/${userId}`,
    BY_ID: id => `/v1/probation/${id}`,
  },
  NOTIFICATIONS: {
    BASE: '/v1/notifications/',
    MARK_READ: id => `/v1/notifications/${id}/read`,
    MARK_ALL: '/v1/notifications/read-all',
    UNREAD_COUNT: '/v1/notifications/unread-count',
  },
  DASHBOARD: {
    ME: '/v1/dashboard/me',
    TEAM: '/v1/dashboard/team',
    COMPANY: '/v1/dashboard/company',
  },
  ADMIN: {
    BASE: '/v1/dashboard/company',
    AUTOMATION: '/v1/dashboard/company',
    FLAGS_TRIAGE: '/v1/admin/flags/triage',
    FLAGS_STATS: '/v1/admin/flags/statistics',
    REPORTS_GOALS: '/v1/admin/reports/goals',
    REPORTS_PROBATION: '/v1/admin/reports/probation',
    REPORTS_REVIEWS: '/v1/admin/reports/reviews',
  }
};

export default API_ENDPOINTS;
