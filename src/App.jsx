import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { LanguageProvider } from '@/lib/i18n';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// App pages
import Dashboard from '@/pages/Dashboard';
import Home from '@/pages/Home';
import Alerts from '@/pages/Alerts';
import AlertDetail from '@/pages/AlertDetail';
import Family from '@/pages/Family';
import Pricing from '@/pages/Pricing';
import AgentChat from '@/pages/AgentChat';
import UrlScanner from '@/pages/UrlScanner';
import Landing from '@/pages/Landing';
import Onboarding from '@/pages/Onboarding';
import Analytics from '@/pages/Analytics';
import Feedback from '@/pages/Feedback';
import Profile from '@/pages/Profile';
import Admin from '@/pages/Admin';
import Lessons from '@/pages/Lessons';
import Privacy from '@/pages/Privacy';
import About from '@/pages/About';
import Contact from '@/pages/Contact';
import Projects from '@/pages/Projects';
import Extension from '@/pages/Extension';
import ScamFeed from '@/pages/ScamFeed';
import LocalScamIntel from '@/pages/LocalScamIntel';
import LocalScamDashboard from '@/pages/LocalScamDashboard';
import PhoneLookup from '@/pages/PhoneLookup';
import ImageScanner from '@/pages/ImageScanner';
import AINegotiator from '@/pages/AINegotiator';
import AdvancedScanner from '@/pages/AdvancedScanner';
import Wrapped from '@/pages/Wrapped';
import Community from '@/pages/Community';

// Layout
import AppLayout from '@/components/layout/AppLayout';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />

      {/* Auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/check" element={<Home />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/agent" element={<AgentChat />} />
          <Route path="/url-scanner" element={<UrlScanner />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/alerts/:id" element={<AlertDetail />} />
          <Route path="/family" element={<Family />} />
          <Route path="/scam-feed" element={<ScamFeed />} />
          <Route path="/local-intel" element={<LocalScamIntel />} />
          <Route path="/local-dashboard" element={<LocalScamDashboard />} />
          <Route path="/phone-lookup" element={<PhoneLookup />} />
          <Route path="/image-scanner" element={<ImageScanner />} />
          <Route path="/ai-negotiator" element={<AINegotiator />} />
          <Route path="/advanced-scanner" element={<AdvancedScanner />} />
          <Route path="/lessons" element={<Lessons />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/extension" element={<Extension />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/wrapped" element={<Wrapped />} />
          <Route path="/community" element={<Community />} />
        </Route>
        <Route path="/onboarding" element={<Onboarding />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <LanguageProvider>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        </LanguageProvider>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App