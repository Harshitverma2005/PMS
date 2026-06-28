import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/auth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Goals from './pages/Goals';
import CreateGoal from './pages/CreateGoal';
import GoalDetail from './pages/GoalDetail';
import Users from './pages/Users';
import Teams from './pages/Teams';
import Cycles from './pages/Cycles';
import PerformanceReview from './pages/PerformanceReview';
import FeedbackForm from './pages/FeedbackForm';
import Probation from './pages/Probation';
import Reports from './pages/Reports';
import FeedbackFlags from './pages/FeedbackFlags';
import Notifications from './pages/Notifications';
import ProbationDetail from './pages/ProbationDetail';

// Pro feature pages
import Timeline from './pages/Timeline';
import Achievements from './pages/Achievements';
import Kudos from './pages/Kudos';
import Readiness from './pages/Readiness';
import ReviewStudio from './pages/ReviewStudio';

function App() {
  const token = useAuthStore((state) => state.token);

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
        
        {/* Protected Application Routes */}
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
        <Route path="/goals/new" element={<ProtectedRoute><CreateGoal /></ProtectedRoute>} />
        <Route path="/goals/:id" element={<ProtectedRoute><GoalDetail /></ProtectedRoute>} />
        
        <Route path="/users" element={<ProtectedRoute requireAdmin><Users /></ProtectedRoute>} />
        <Route path="/teams" element={<ProtectedRoute><Teams /></ProtectedRoute>} />
        
        <Route path="/cycles" element={<ProtectedRoute><Cycles /></ProtectedRoute>} />
        <Route path="/probation" element={<ProtectedRoute><Probation /></ProtectedRoute>} />
        <Route path="/probation/:id" element={<ProtectedRoute><ProbationDetail /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/feedback-flags" element={<ProtectedRoute requireAdmin><FeedbackFlags /></ProtectedRoute>} />
        
        <Route path="/performance" element={<ProtectedRoute><PerformanceReview /></ProtectedRoute>} />
        <Route path="/performance/form/:id" element={<ProtectedRoute><FeedbackForm /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

        {/* Pro feature routes */}
        <Route path="/timeline" element={<ProtectedRoute><Timeline /></ProtectedRoute>} />
        <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
        <Route path="/kudos" element={<ProtectedRoute><Kudos /></ProtectedRoute>} />
        <Route path="/readiness" element={<ProtectedRoute><Readiness /></ProtectedRoute>} />
        <Route path="/review-studio/:formId" element={<ProtectedRoute><ReviewStudio /></ProtectedRoute>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

