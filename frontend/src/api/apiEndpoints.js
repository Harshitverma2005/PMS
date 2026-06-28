export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
  },
  GOALS: {
    BASE: '/goals/',
    BY_ID: id => `/goals/${id}`,
    SUBMIT: id => `/goals/${id}/submit`,
    APPROVE: id => `/goals/${id}/approve`,
    PROGRESS: id => `/goals/${id}/progress`,
    SUBTASKS: id => `/goals/${id}/subtasks`,
    SCORING: id => `/goals/${id}/score`,
    MEMBER_FEEDBACK: id => `/goals/${id}/feedback/member`,
    EVALUATOR_FEEDBACK: id => `/goals/${id}/feedback/evaluator`,
    ARCHIVE: id => `/goals/${id}/archive`,
    HISTORY: id => `/goals/${id}/history`,
  },
  USERS: {
    BASE: '/users/',
    BY_ID: id => `/users/${id}`,
    WEIGHTAGE: (userId, tag) => `/users/${userId}/weightage/${tag}`,
  },
  TEAMS: {
    BASE: '/teams/',
    BY_ID: id => `/teams/${id}`,
  },
  CYCLES: {
    BASE: '/review-cycles/',
    BY_ID: id => `/review-cycles/${id}`,
    TRIGGER: id => `/review-cycles/${id}/trigger`,
    CLOSE: id => `/review-cycles/${id}/close`,
    COMPLIANCE: id => `/review-cycles/${id}/compliance`,
  },
  FEEDBACK: {
    BASE: '/review-forms/',
    BY_ID: id => `/review-forms/${id}`,
    SUBMIT: id => `/review-forms/${id}/submit`,
    FLAGS: '/admin/flags/triage',
    FLAG_DETAIL: id => `/admin/flags/${id}/review`,
  },
  PROBATION: {
    BASE: '/probation/',
    ME: (userId) => `/probation/employee/${userId}`,
    BY_ID: id => `/probation/${id}`,
  },
  NOTIFICATIONS: {
    BASE: '/notifications/',
    MARK_READ: id => `/notifications/${id}/read`,
    MARK_ALL: '/notifications/read-all',
    UNREAD_COUNT: '/notifications/unread-count',
  },
  DASHBOARD: {
    ME: '/dashboard/me',
    TEAM: '/dashboard/team',
    COMPANY: '/dashboard/company',
  },
  ADMIN: {
    BASE: '/dashboard/company',
    DASHBOARD: '/dashboard/company',
    AUTOMATION: '/dashboard/company',
    FLAGS_TRIAGE: '/admin/flags/triage',
    FLAGS_STATS: '/admin/flags/statistics',
    REPORTS_GOALS: '/admin/reports/goals',
    REPORTS_PROBATION: '/admin/reports/probation',
    REPORTS_REVIEWS: '/admin/reports/reviews',
  }
};

export default API_ENDPOINTS;
