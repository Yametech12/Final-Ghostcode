import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Layout from './Layout';
import { LoadingScreen, InlineLoader } from '../LoadingComponents';
import { useEnhancedAuth } from '../../contexts/EnhancedAuthContext';

// Critical pages - loaded immediately without retry wrapper
const HomePage = lazy(() => import('../../pages/HomePage'));
const LoginPage = lazy(() => import('../../pages/LoginPage'));
const RegisterPage = lazy(() => import('../../pages/RegisterPage'));
const ResetPasswordPage = lazy(() => import('../../pages/ResetPasswordPage'));

// Legal pages - public, no auth required
const TermsPage = lazy(() => import('../../pages/TermsPage'));
const PrivacyPage = lazy(() => import('../../pages/PrivacyPage'));

// Marketing pages - public, no auth required
const LandingPage = lazy(() => import('../../pages/LandingPage'));
const PricingPage = lazy(() => import('../../pages/PricingPage'));

// Paywall screen — shown when free user hits paid content
const PaywallScreen = lazy(() => import('../../components/PaywallScreen'));

// Core functionality pages - high priority
const ProfilePage = lazy(() => import('../../pages/ProfilePage'));
const AdvisorPage = lazy(() => import('../../pages/AdvisorPage'));
const AssessmentPage = lazy(() => import('../../pages/AssessmentPage'));
const AssessmentResultPage = lazy(() => import('../../pages/AssessmentResultPage'));

// Tool pages - medium priority
const CalibrationPage = lazy(() => import('../../pages/CalibrationPage'));
const ProfilerPage = lazy(() => import('../../pages/ProfilerPage'));
const QuizPage = lazy(() => import('../../pages/QuizPage'));
const ComparePage = lazy(() => import('../../pages/ComparePage'));
const SimulationPage = lazy(() => import('../../pages/SimulationPage'));
const DecryptorPage = lazy(() => import('../../pages/DecryptorPage'));

// Reference pages - lower priority
const EncyclopediaPage = lazy(() => import('../../pages/EncyclopediaPage'));
const GuidePage = lazy(() => import('../../pages/GuidePage'));
const FieldGuidePage = lazy(() => import('../../pages/FieldGuidePage'));
const GlossaryPage = lazy(() => import('../../pages/GlossaryPage'));
const QuickReferencePage = lazy(() => import('../../pages/QuickReferencePage'));

// Utility pages - lowest priority
const FavoritesPage = lazy(() => import('../../pages/FavoritesPage'));
const DossiersPage = lazy(() => import('../../pages/DossiersPage'));
const InsightsPage = lazy(() => import('../../pages/InsightsPage'));
const AdminDashboard = lazy(() => import('../../pages/AdminDashboard'));

const pageVariants = {
  initial: { opacity: 0, y: 15, scale: 0.99 },
  in: { opacity: 1, y: 0, scale: 1 },
  out: { opacity: 0, y: -15, scale: 0.99 }
};

const pageTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 1
};

function ProtectedRoute({
  children,
  requireAdmin,
  requireTier,
  featureName,
  featurePitch,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  /** If set, the user's subscription tier must meet this. Admins always pass. */
  requireTier?: 'strategist' | 'oracle';
  /** Used by the paywall screen when locked. */
  featureName?: string;
  featurePitch?: string;
}) {
  const auth = useEnhancedAuth();
  if (!auth) {
    return <LoadingScreen />;
  }
  const { user, userData, loading } = auth;

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && userData?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Subscription gate. Admins bypass — they need access to demo & debug
  // every feature regardless of billing state.
  if (requireTier && userData?.role !== 'admin') {
    const userTier = userData?.subscriptionTier ?? 'free';
    const expiresAt = userData?.subscriptionExpiresAt
      ? new Date(userData.subscriptionExpiresAt).getTime()
      : null;
    const isExpired = expiresAt !== null && expiresAt < Date.now();

    const tierRank: Record<string, number> = { free: 0, strategist: 1, oracle: 2 };
    const meetsTier = !isExpired && tierRank[userTier] >= tierRank[requireTier];

    if (!meetsTier) {
      return (
        <Layout forceScrollable>
          <Suspense fallback={<InlineLoader />}>
            <PaywallScreen
              requiredTier={requireTier}
              featureName={featureName ?? 'This feature'}
              featurePitch={featurePitch}
            />
          </Suspense>
        </Layout>
      );
    }
  }

  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const auth = useEnhancedAuth();
  if (!auth) {
    return <LoadingScreen />;
  }
  const { user, loading } = auth;

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

/**
 * Root route splitter:
 * - Signed-out visitors see the public LandingPage (marketing front door).
 * - Signed-in users see the HomePage dashboard wrapped in Layout.
 * Keeping both behind a single `/` URL means the marketing page is the
 * default first impression without breaking signed-in deep links.
 */
function RootRoute() {
  const auth = useEnhancedAuth();
  if (!auth) {
    return <LoadingScreen />;
  }
  const { user, loading } = auth;

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <Suspense fallback={<InlineLoader />}>
        <LandingPage />
      </Suspense>
    );
  }

  return (
    <Layout>
      <Suspense fallback={<InlineLoader />}>
        <PageWrapper><HomePage /></PageWrapper>
      </Suspense>
    </Layout>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="w-full min-h-full"
    >
      {children}
    </motion.div>
  );
}

export default function AnimatedRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<LoadingScreen />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          {/*
            /reset-password is intentionally NOT wrapped in PublicRoute. The
            recovery email link briefly authenticates the user (Supabase emits
            PASSWORD_RECOVERY), and PublicRoute would immediately bounce them
            home before they can set a new password.
          */}
          <Route path="/reset-password" element={
            <Suspense fallback={<InlineLoader />}>
              <ResetPasswordPage />
            </Suspense>
          } />
          {/*
            Legal pages are public — anyone can read them, even when signed
            out and even from the registration flow without losing their
            in-progress form state. Not wrapped in PublicRoute so a signed-in
            user who follows a footer link can still review them.
          */}
          <Route path="/terms" element={
            <Suspense fallback={<InlineLoader />}>
              <TermsPage />
            </Suspense>
          } />
          <Route path="/privacy" element={
            <Suspense fallback={<InlineLoader />}>
              <PrivacyPage />
            </Suspense>
          } />
          {/*
            Public marketing pages — landing and pricing. Not wrapped in
            PublicRoute so signed-in users following a footer or shared link
            can still visit them without being bounced home.
          */}
          <Route path="/welcome" element={
            <Suspense fallback={<InlineLoader />}>
              <LandingPage />
            </Suspense>
          } />
          <Route path="/pricing" element={
            <Suspense fallback={<InlineLoader />}>
              <PricingPage />
            </Suspense>
          } />
          <Route path="/calibration" element={
            <ProtectedRoute
              requireTier="strategist"
              featureName="Calibration"
              featurePitch="Train your eye to read her archetype in thirty seconds. Drill the signals until they're second nature."
            >
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><CalibrationPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          {/*
            Root route is split by auth state:
            - Signed out → public LandingPage (marketing front door)
            - Signed in  → HomePage (the app dashboard)
            This way new visitors see the marketing page first, not /login.
          */}
          <Route path="/" element={<RootRoute />} />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><ProfilePage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/encyclopedia" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><EncyclopediaPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/guide" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><GuidePage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/field-guide" element={
            <ProtectedRoute
              requireTier="strategist"
              featureName="Field Guide"
              featurePitch="Quick-reference scenarios and tactical lines for the moments that move too fast to think."
            >
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><FieldGuidePage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/advisor" element={
            <ProtectedRoute
              requireTier="strategist"
              featureName="AI Advisor"
              featurePitch="Consult the Oracle in real time. Strategic guidance grounded in the EPIMETHEUS framework, on call 24/7."
            >
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><AdvisorPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/compare" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><ComparePage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/glossary" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><GlossaryPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/quick-reference" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><QuickReferencePage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/assessment" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><AssessmentPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/assessment-result" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><AssessmentResultPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><AdminDashboard /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/profiler" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><ProfilerPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/quiz" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><QuizPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/favorites" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><FavoritesPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/dossiers" element={
            <ProtectedRoute
              requireTier="strategist"
              featureName="Subject Dossiers"
              featurePitch="Profile the women in your orbit. Track interactions, log signals, spot patterns over time."
            >
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><DossiersPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/decryptor" element={
            <ProtectedRoute
              requireTier="strategist"
              featureName="Signal Decryptor"
              featurePitch="Paste a message. Read the subtext, the emotional state, and the move beneath the words."
            >
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><DecryptorPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/simulation" element={
            <ProtectedRoute
              requireTier="strategist"
              featureName="Simulation Matrix"
              featurePitch="Interactive roleplay. Rehearse the conversations that decide everything, before the real one happens."
            >
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><SimulationPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/insights" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><InsightsPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}
