import { create } from 'zustand';

// Mock Personas
export const PERSONAS = {
  EMPLOYEE: {
    id: 'emp-1',
    name: 'harshit',
    role: 'employee',
    email: 'employee@pms.io',
    avatar: 'H',
    managerId: 'mgr-1'
  },
  EMPLOYEE2: {
    id: 'emp-2',
    name: 'gourav',
    role: 'employee',
    email: 'gourav@pms.io',
    avatar: 'G',
    managerId: 'mgr-1'
  },
  EMPLOYEE3: {
    id: 'emp-3',
    name: 'awinash',
    role: 'employee',
    email: 'awinash@pms.io',
    avatar: 'A',
    managerId: 'mgr-2'
  },
  MANAGER: {
    id: 'mgr-1',
    name: 'aman',
    role: 'manager',
    email: 'manager@pms.io',
    avatar: 'A'
  },
  MANAGER2: {
    id: 'mgr-2',
    name: 'prashant',
    role: 'manager',
    email: 'prashant@pms.io',
    avatar: 'P'
  },
  HR: {
    id: 'hr-1',
    name: 'sandeep',
    role: 'hr',
    email: 'admin@pms.io',
    avatar: 'S'
  }
};

const INITIAL_GOALS = [
  {
    id: 'g-1',
    title: 'Improve API Performance',
    description: 'Reduce average response time by 30%.',
    employeeId: 'emp-1',
    createdBy: 'mgr-1',
    priority: 'High',
    difficulty: 'Hard',
    estimatedHours: 40,
    businessImpact: 'Critical for Q3 user retention goals.',
    dueDate: '2026-09-30',
    progress: 45,
    status: 'Active',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'g-2',
    title: 'Migrate to React 18',
    description: 'Upgrade the main dashboard application.',
    employeeId: 'emp-1',
    createdBy: 'emp-1',
    priority: 'Medium',
    difficulty: 'Medium',
    estimatedHours: 60,
    businessImpact: 'Improves rendering speed.',
    dueDate: '2026-08-15',
    progress: 0,
    status: 'Pending Approval',
    createdAt: '2026-06-25T14:30:00Z',
  }
];

const INITIAL_EVENTS = [
  { id: 'e-1', type: 'Goal Created', userId: 'emp-1', goalId: 'g-1', timestamp: '2026-01-10T10:00:00Z', metadata: { title: 'Improve API Performance' } },
  { id: 'e-2', type: 'Progress Update', userId: 'emp-1', goalId: 'g-1', timestamp: '2026-02-15T09:00:00Z', metadata: { progress: 20 } },
  { id: 'e-3', type: 'Achievement', userId: 'emp-1', timestamp: '2026-03-01T11:00:00Z', metadata: { title: 'Completed GraphQL Course' } },
  { id: 'e-4', type: 'Progress Update', userId: 'emp-1', goalId: 'g-1', timestamp: '2026-04-10T15:00:00Z', metadata: { progress: 45 } },
  { id: 'e-5', type: 'Feedback', userId: 'emp-1', createdBy: 'mgr-1', timestamp: '2026-05-05T14:00:00Z', metadata: { text: 'Great progress on the API performance task.' } },
];

export const usePerformStore = create((set, get) => ({
  isAuthenticated: false,
  currentUser: PERSONAS.EMPLOYEE,
  
  // Data
  users: Object.values(PERSONAS),
  goals: INITIAL_GOALS,
  events: INITIAL_EVENTS,
  reviews: [
    // Harshit (emp-1) — current cycle self review, pending
    {
      id: 'r-1', type: 'self', status: 'pending',
      employeeId: 'emp-1', managerId: 'mgr-1',
      period: 'H1 2026', cycleId: 'c-1', cycle: { name: 'H1 2026 Bi-Annual' },
      responses: {}, rating: 'meets',
      createdAt: '2026-06-20T10:00:00Z'
    },
    // Harshit (emp-1) — last cycle self review, submitted (history)
    {
      id: 'r-2', type: 'self', status: 'submitted',
      employeeId: 'emp-1', managerId: 'mgr-1',
      period: 'H2 2025', cycleId: 'c-0', cycle: { name: 'H2 2025 Bi-Annual' },
      responses: {
        comments: 'Delivered the caching layer ahead of schedule and mentored two interns.',
        quality_deliverables: 4, timeliness: 4, innovation: 5, collaboration: 4, impact: 4
      },
      rating: 'meets',
      createdAt: '2025-12-15T10:00:00Z'
    },
    // Manager review of Harshit (emp-1) — to be completed by aman (mgr-1) in Review Studio
    {
      id: 'r-3', type: 'manager', status: 'pending',
      employeeId: 'emp-1', managerId: 'mgr-1',
      period: 'H1 2026', cycleId: 'c-1', cycle: { name: 'H1 2026 Bi-Annual' },
      responses: { comments: 'Delivered the API performance work; wants to grow into system design.' },
      rating: 0,
      createdAt: '2026-06-21T10:00:00Z'
    },
    // Manager review of Gourav (emp-2) — to be completed by aman (mgr-1) in Review Studio
    {
      id: 'r-4', type: 'manager', status: 'pending',
      employeeId: 'emp-2', managerId: 'mgr-1',
      period: 'H1 2026', cycleId: 'c-1', cycle: { name: 'H1 2026 Bi-Annual' },
      responses: { comments: 'Shipped Redis caching and reduced latency by 40%.' },
      rating: 0,
      createdAt: '2026-06-21T10:00:00Z'
    }
  ],
  kudos: [
    {
      id: 'k-1',
      senderId: 'mgr-1',
      recipientId: 'emp-1',
      message: 'Huge thanks for stepping up and fixing the critical bug last night. You saved the release! 🎉',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ],
  cycles: [
    {
      id: 'c-1',
      name: 'H1 2026 Bi-Annual',
      track: 'bi_annual',
      periodStart: '2026-04-01',
      periodEnd: '2026-09-30',
      isActive: true
    }
  ],
  probations: [
    {
      id: 'p-1',
      employeeId: 'emp-2', // Gourav
      status: 'on_track',
      startDate: new Date(Date.now() - 20 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 70 * 86400000).toISOString(),
      checkin30: 'pending',
      checkin60: 'pending',
      checkin90: 'pending'
    },
    {
      id: 'p-2',
      employeeId: 'emp-3', // Awinash
      status: 'at_risk',
      startDate: new Date(Date.now() - 10 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 80 * 86400000).toISOString(),
      checkin30: 'pending',
      checkin60: 'pending',
      checkin90: 'pending'
    }
  ],
  achievements: [
    {
      id: 'ach-1',
      title: 'Reduced API latency by 40%',
      description: 'Refactored core endpoints to use Redis caching.',
      category: 'technical_impact',
      employeeId: 'emp-2',
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString()
    }
  ],
  
  // Actions
  login: (user) => set({ isAuthenticated: true, currentUser: user }),
  logout: () => set({ isAuthenticated: false, currentUser: PERSONAS.EMPLOYEE }),
  switchPersona: (roleKey) => {
    set({ currentUser: PERSONAS[roleKey] });
  },

  // Goals
  addGoal: (goal) => set((state) => {
    const newGoal = {
      ...goal,
      id: `g-${Date.now()}`,
      createdAt: new Date().toISOString(),
      progress: 0,
      status: goal.status || 'Active'
    };
    
    return { goals: [...state.goals, newGoal] };
  }),

  addAchievement: (achievement) => set((state) => {
    const newAch = {
      ...achievement,
      id: `ach-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    return { achievements: [newAch, ...state.achievements] };
  }),

  updateGoalStatus: (id, status) => set((state) => {
    return {
      goals: state.goals.map((g) => g.id === id ? { ...g, status } : g)
    };
  }),

  updateGoalProgress: (id, progress) => set((state) => {
    return {
      goals: state.goals.map((g) => g.id === id ? { ...g, progress } : g)
    };
  }),

  // Events
  addEvent: (event) => set((state) => ({
    events: [{
      ...event,
      id: `e-${Date.now()}`,
      timestamp: new Date().toISOString()
    }, ...state.events]
  })),

  // Kudos
  addKudos: (kudosData) => set((state) => ({
    kudos: [{
      ...kudosData,
      id: `k-${Date.now()}`,
      createdAt: new Date().toISOString()
    }, ...state.kudos]
  })),

  // Workload Calculation
  getWorkloadForUser: (userId) => {
    const state = get();
    const activeGoals = state.goals.filter(g => g.employeeId === userId && g.status === 'Active');
    
    let totalHours = 0;
    activeGoals.forEach(g => {
      let multiplier = 1;
      if (g.difficulty === 'Hard') multiplier = 1.2;
      if (g.difficulty === 'Critical') multiplier = 1.5;
      
      totalHours += (g.estimatedHours || 0) * multiplier;
    });

    totalHours += (activeGoals.length * 2);

    let status = 'Healthy';
    if (totalHours > 40) status = 'Busy';
    if (totalHours > 70) status = 'High Load';
    if (totalHours > 100) status = 'Overloaded';

    return { hours: Math.round(totalHours), status, count: activeGoals.length };
  },

  // Readiness Calculation
  getReadinessForUser: (userId) => {
    const state = get();
    const userGoals = state.goals.filter(g => g.employeeId === userId);
    const userEvents = state.events.filter(e => e.userId === userId);
    
    const hasGoals = userGoals.length > 0;
    const hasProgress = userGoals.some(g => g.progress > 0);
    const hasAchievements = userEvents.some(e => e.type === 'Achievement');
    const hasFeedback = userEvents.some(e => e.type === 'Feedback');
    const hasCheckins = userEvents.some(e => e.type === 'Check-in');

    let score = 0;
    if (hasGoals) score += 30;
    if (hasProgress) score += 20;
    if (hasAchievements) score += 20;
    if (hasFeedback) score += 20;
    if (hasCheckins) score += 10;

    return {
      score,
      breakdown: { hasGoals, hasProgress, hasAchievements, hasFeedback, hasCheckins }
    };
  }
}));
