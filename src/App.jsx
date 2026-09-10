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
import { KidModeProvider } from '@/lib/KidModeContext';

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
import GuardianDashboard from '@/pages/GuardianDashboard';
import Pricing from '@/pages/Pricing';
import AgentChat from '@/pages/AgentChat';
import UrlScanner from '@/pages/UrlScanner';
import Landing from '@/pages/Landing';
import Onboarding from '@/pages/Onboarding';
import Analytics from '@/pages/Analytics';
import AdvancedScanner from '@/pages/AdvancedScanner';
import EmergencyResponse from '@/pages/EmergencyResponse';
import TrustHistory from '@/pages/TrustHistory';
import Feedback from '@/pages/Feedback';
import Profile from '@/pages/Profile';
import Admin from '@/pages/Admin';
import Lessons from '@/pages/Lessons';
import Privacy from '@/pages/Privacy';
import DataCollection from '@/pages/DataCollection';
import Terms from '@/pages/Terms';
import About from '@/pages/About';
import Contact from '@/pages/Contact';
import Extension from '@/pages/Extension';
import ScamFeed from '@/pages/ScamFeed';
import LocalScamIntel from '@/pages/LocalScamIntel';
import PhoneLookup from '@/pages/PhoneLookup';
import PhoneGuard from '@/pages/PhoneGuard';
import ImageScanner from '@/pages/ImageScanner';
import AINegotiator from '@/pages/AINegotiator';
import KidScanner from '@/pages/KidScanner';
import KidGames from '@/pages/KidGames';
import KidLibrary from '@/pages/KidLibrary';
import SpotTheScam from '@/pages/SpotTheScam';
import ConversationAnalyzer from '@/pages/ConversationAnalyzer';
import IncognitoSearch from '@/pages/IncognitoSearch';
import Wrapped from '@/pages/Wrapped';
import Community from '@/pages/Community';
import CallSimulator from '@/pages/CallSimulator';
import CryptoScanner from '@/pages/CryptoScanner';
import MobileApp from '@/pages/MobileApp';
import BulkScanner from '@/pages/BulkScanner';
import CallScreener from '@/pages/CallScreener';


// Layout
import AppLayout from '@/components/layout/AppLayout';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, isAuthenticated, authChecked, authError } = useAuth();
  const isRootLanding = window.location.pathname === "/";
  const isLandingPage = window.location.pathname === "/landing" || window.location.pathname.startsWith("/landing/");
  const isPublicLanding = isRootLanding || isLandingPage;

  // The root URL is the entry point for returning customers. Do not render the
  // public landing page while we are still resolving an existing session: doing
  // so creates a visible landing -> dashboard transition and can race with the
  // protected route bootstrap. Show the same startup screen until auth is known.
  // Once resolved, authenticated users go directly to the dashboard; signed-out
  // visitors see the original green landing page.
  if (isPublicLanding && !authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#f7fbfa]">
        <div className="flex flex-col items-center gap-3 text-primary">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-600/20">
            <img src="/favicon.svg" alt="" width="32" height="32" />
          </div>
          <div className="text-xl font-bold tracking-tight">Vardin</div>
          <div className="w-6 h-6 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Only the root URL is the first-time visitor entry point. Keep /landing
  // available from inside the app so returning users can explicitly view it.
  if (isRootLanding && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!isPublicLanding && (isLoadingPublicSettings || isLoadingAuth)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isPublicLanding && authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    if (authError.type === 'auth_required') {
      return <Navigate to="/login" replace />;
    }
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      {/* Public landing aliases: keep the existing Landing page reachable from internal links and direct URLs. */}
      <Route path="/landing" element={<Landing />} />
      <Route path="/landing/*" element={<Landing />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/data-collection" element={<DataCollection />} />
      <Route path="/terms" element={<Terms />} />

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
          <Route path="/guardian-dashboard" element={<GuardianDashboard />} />
          <Route path="/scam-feed" element={<ScamFeed />} />
          <Route path="/local-intel" element={<LocalScamIntel />} />
          <Route path="/phone-lookup" element={<PhoneGuard />} />
          <Route path="/live-guard" element={<Navigate to="/phone-lookup?tab=live" replace />} />
          <Route path="/call-simulator" element={<CallSimulator />} />
          <Route path="/crypto-scanner" element={<CryptoScanner />} />
          <Route path="/bulk-scanner" element={<BulkScanner />} />
          <Route path="/call-screener" element={<CallScreener />} />
          <Route path="/mobile-app" element={<MobileApp />} />
          <Route path="/image-scanner" element={<ImageScanner />} />
          <Route path="/ai-negotiator" element={<AINegotiator />} />
          <Route path="/advanced-scanner" element={<Navigate to="/universal-scan" replace />} />
          <Route path="/kid-scanner" element={<KidScanner />} />
          <Route path="/kid-games" element={<KidGames />} />
          <Route path="/kid-library" element={<KidLibrary />} />
          <Route path="/spot-the-scam" element={<SpotTheScam />} />
          <Route path="/conversation-analyzer" element={<ConversationAnalyzer />} />
          <Route path="/incognito-search" element={<IncognitoSearch />} />
          <Route path="/lessons" element={<Lessons />} />
          <Route path="/extension" element={<Extension />} />
          <Route path="/analytics" element={<Analytics />} />

          <Route path="/universal-scan" element={<AdvancedScanner />} />
          <Route path="/emergency-response" element={<EmergencyResponse />} />
          <Route path="/trust-history" element={<TrustHistory />} />
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
          <KidModeProvider>
            <AuthenticatedApp />
          </KidModeProvider>
        </Router>
        </LanguageProvider>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App