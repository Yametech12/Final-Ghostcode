import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Layout from './Layout';
import { LoadingScreen, InlineLoader } from './LoadingComponents';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';

// Critical pages - loaded immediately without retry wrapper
const HomePage = lazy(() => import('../pages/HomePage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));

// Core functionality pages - high priority
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const AdvisorPage = lazy(() => import('../pages/AdvisorPage'));
const AssessmentPage = lazy(() => import('../pages/AssessmentPage'));
const AssessmentResultPage = lazy(() => import('../pages/AssessmentResultPage'));

// Tool pages - medium priority
const CalibrationPage = lazy(() => import('../pages/CalibrationPage'));
const ProfilerPage = lazy(() => import('../pages/ProfilerPage'));
const QuizPage = lazy(() => import('../pages/QuizPage'));
const ComparePage = lazy(() => import('../pages/ComparePage'));
const SimulationPage = lazy(() => import('../pages/SimulationPage'));
const DecryptorPage = lazy(() => import('../pages/DecryptorPage'));

// Reference pages - lower priority
const EncyclopediaPage = lazy(() => import('../pages/EncyclopediaPage'));
const GuidePage = lazy(() => import('../pages/GuidePage'));
const FieldGuidePage = lazy(() => import('../pages/FieldGuidePage'));
const GlossaryPage = lazy(() => import('../pages/GlossaryPage'));
const QuickReferencePage = lazy(() => import('../pages/QuickReferencePage'));

// Utility pages - lowest priority
const FavoritesPage = lazy(() => import('../pages/FavoritesPage'));
const DossiersPage = lazy(() => import('../pages/DossiersPage'));
const InsightsPage = lazy(() => import('../pages/InsightsPage'));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'));

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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useEnhancedAuth();
  if (!auth) {
    return <LoadingScreen />;
  }
  const { user, loading } = auth;

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
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
          <Route path="/calibration" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><CalibrationPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><HomePage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
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
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><FieldGuidePage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/advisor" element={
            <ProtectedRoute>
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
            <ProtectedRoute>
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
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><DossiersPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/decryptor" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><DecryptorPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/simulation" element={
            <ProtectedRoute>
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
