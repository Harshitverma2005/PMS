import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Goals from './pages/Goals';
import CreateGoal from './pages/CreateGoal';
import Timeline from './pages/Timeline';
import Readiness from './pages/Readiness';
import WorkloadIntelligence from './pages/WorkloadIntelligence';

// Legacy pages
import Users from './pages/Users';
import Teams from './pages/Teams';
import Cycles from './pages/Cycles';
import Probation from './pages/Probation';
import ProbationDetail from './pages/ProbationDetail';
import Reports from './pages/Reports';
import FeedbackFlags from './pages/FeedbackFlags';
import PerformanceReview from './pages/PerformanceReview';
import FeedbackForm from './pages/FeedbackForm';
import Achievements from './pages/Achievements';
import Kudos from './pages/Kudos';
import ReviewStudioHub from './pages/ReviewStudioHub';
import ReviewStudio from './pages/ReviewStudio';
import GoalDetail from './pages/GoalDetail';
import Notifications from './pages/Notifications';
import { useAuthStore } from './store/auth';

function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        
        {isAuthenticated ? (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/goals/new" element={<CreateGoal />} />
            <Route path="/goals/:id" element={<GoalDetail />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/readiness" element={<Readiness />} />
            <Route path="/workload" element={<WorkloadIntelligence />} />
            
            {/* Legacy restored routes */}
            <Route path="/users" element={<Users />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/cycles" element={<Cycles />} />
            <Route path="/probation" element={<Probation />} />
            <Route path="/probation/:id" element={<ProbationDetail />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/feedback-flags" element={<FeedbackFlags />} />
            <Route path="/performance" element={<PerformanceReview />} />
            <Route path="/performance/form/:id" element={<FeedbackForm />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/kudos" element={<Kudos />} />
            <Route path="/review-studio" element={<ReviewStudioHub />} />
            <Route path="/review-studio/:formId" element={<ReviewStudio />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
