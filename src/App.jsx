import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from '@/components/ErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
import { LanguageProvider } from '@/lib/i18n';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// App pages (lazy-loaded to keep the initial bundle small for public beta).
// Landing, LegalNotice and AppLayout stay eager so the marketing page, legal
// toast and the app shell render without a Suspense flash.
import Landing from '@/pages/Landing';
import LegalNotice from '@/components/legal/LegalNotice';
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Home = lazy(() => import('@/pages/Home'));
const Alerts = lazy(() => import('@/pages/Alerts'));
const AlertDetail = lazy(() => import('@/pages/AlertDetail'));
const Family = lazy(() => import('@/pages/Family'));
const GuardianDashboard = lazy(() => import('@/pages/GuardianDashboard'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const AgentChat = lazy(() => import('@/pages/AgentChat'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const AdvancedScanner = lazy(() => import('@/pages/AdvancedScanner'));
const EmergencyResponse = lazy(() => import('@/pages/EmergencyResponse'));
const TrustHistory = lazy(() => import('@/pages/TrustHistory'));
const Feedback = lazy(() => import('@/pages/Feedback'));
const Profile = lazy(() => import('@/pages/Profile'));
const Admin = lazy(() => import('@/pages/Admin'));
const Lessons = lazy(() => import('@/pages/Lessons'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const DataCollection = lazy(() => import('@/pages/DataCollection'));
const Terms = lazy(() => import('@/pages/Terms'));
const Cookies = lazy(() => import('@/pages/Cookies'));
const About = lazy(() => import('@/pages/About'));
const Contact = lazy(() => import('@/pages/Contact'));
const Extension = lazy(() => import('@/pages/Extension'));
const ScamFeed = lazy(() => import('@/pages/ScamFeed'));
const LocalScamIntel = lazy(() => import('@/pages/LocalScamIntel'));
const PhoneGuard = lazy(() => import('@/pages/PhoneGuard'));
const ImageScanner = lazy(() => import('@/pages/ImageScanner'));
const AINegotiator = lazy(() => import('@/pages/AINegotiator'));
const SpotTheScam = lazy(() => import('@/pages/SpotTheScam'));
const ConversationAnalyzer = lazy(() => import('@/pages/ConversationAnalyzer'));
const IncognitoSearch = lazy(() => import('@/pages/IncognitoSearch'));
const Wrapped = lazy(() => import('@/pages/Wrapped'));
const Community = lazy(() => import('@/pages/Community'));
const Referral = lazy(() => import('@/pages/Referral'));
const CallSimulator = lazy(() => import('@/pages/CallSimulator'));
const CryptoScanner = lazy(() => import('@/pages/CryptoScanner'));
const MobileApp = lazy(() => import('@/pages/MobileApp'));
const BulkScanner = lazy(() => import('@/pages/BulkScanner'));

// Layout
import AppLayout from '@/components/layout/AppLayout';

const RouteLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
  </div>
);

const RootEntry = () => {
  const { isLoadingAuth, isAuthenticated, authChecked } = useAuth();
  const hasVisitedSite = (() => {
    try {
      return window.localStorage.getItem("vardin_site_visited") === "1";
    } catch {
      return false;
    }
  })();

  // Root is a deterministic entry point: authenticated users enter the app,
  // while first-time/signed-out visitors see the original landing page.
  // Using a router element avoids a full-page redirect and the refresh race.
  if (!authChecked || isLoadingAuth) {
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

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  // The real landing page is only the first-time browser entry point. Once this
  // browser has visited Vardin before, an unauthenticated return goes to login
  // instead of showing the landing page again. The dedicated /landing?view=1
  // route remains the in-app, view-only landing experience.
  if (hasVisitedSite) return <Navigate to="/login" replace />;
  return <Landing />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authChecked, authError } = useAuth();
  const currentPath = window.location.pathname;
  const isRootLanding = currentPath === "/";
  const isLandingPage = currentPath === "/landing" || currentPath.startsWith("/landing/");
  const isPublicLanding = isRootLanding || isLandingPage;

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
    <ErrorBoundary>
    <Suspense fallback={<RouteLoader />}>
    <Routes>
      {/* Root entry: returning users -> dashboard; first-time/signed-out users -> original landing. */}
      <Route path="/" element={<RootEntry />} />
      {/* Public landing aliases: keep the existing Landing page reachable from internal links and direct URLs. */}
      <Route path="/landing" element={<Landing />} />
      <Route path="/landing/*" element={<Landing />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/data-collection" element={<DataCollection />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/cookies" element={<Cookies />} />

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
          <Route path="/mobile-app" element={<MobileApp />} />
          <Route path="/image-scanner" element={<ImageScanner />} />
          <Route path="/scam-exposer" element={<AINegotiator />} />
          <Route path="/ai-negotiator" element={<Navigate to="/scam-exposer" replace />} />
          <Route path="/advanced-scanner" element={<Navigate to="/universal-scan" replace />} />
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
          <Route path="/referral" element={<Referral />} />

        </Route>
        <Route path="/onboarding" element={<Onboarding />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
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
          <LegalNotice />
        </Router>
        </LanguageProvider>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App