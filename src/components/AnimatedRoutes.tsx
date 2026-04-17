import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Layout from './Layout';
import { LoadingScreen, InlineLoader } from './LoadingComponents';
import { useAuth } from '../context/AuthContext';
import { lazyWithRetry } from '../utils/lazyWithRetry';

// Critical pages - loaded immediately on app start
const HomePage = lazyWithRetry(() => import('../pages/HomePage'));

// Core functionality pages - high priority
const ProfilesPage = lazyWithRetry(() => import('../pages/ProfilesPage'));
const AdvisorPage = lazyWithRetry(() => import('../pages/AdvisorPage'));
const AssessmentPage = lazyWithRetry(() => import('../pages/AssessmentPage'));
const AssessmentResultPage = lazyWithRetry(() => import('../pages/AssessmentResultPage'));

// Tool pages - medium priority
// const CalibrationPage = lazyWithRetry(() => import('../pages/CalibrationPage'));
const ProfilerPage = lazyWithRetry(() => import('../pages/ProfilerPage'));
const QuizPage = lazyWithRetry(() => import('../pages/QuizPage'));
const ComparePage = lazyWithRetry(() => import('../pages/ComparePage'));
const SimulationPage = lazyWithRetry(() => import('../pages/SimulationPage'));
const DecryptorPage = lazyWithRetry(() => import('../pages/DecryptorPage'));

// Reference pages - lower priority
const EncyclopediaPage = lazyWithRetry(() => import('../pages/EncyclopediaPage'));
const GuidePage = lazyWithRetry(() => import('../pages/GuidePage'));
const FieldGuidePage = lazyWithRetry(() => import('../pages/FieldGuidePage'));
const GlossaryPage = lazyWithRetry(() => import('../pages/GlossaryPage'));
const QuickReferencePage = lazyWithRetry(() => import('../pages/QuickReferencePage'));

// Utility pages - lowest priority
const FavoritesPage = lazyWithRetry(() => import('../pages/FavoritesPage'));
const DossiersPage = lazyWithRetry(() => import('../pages/DossiersPage'));
const InsightsPage = lazyWithRetry(() => import('../pages/InsightsPage'));
const AdminDashboard = lazyWithRetry(() => import('../pages/AdminDashboard'));

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
  // Authentication disabled - allow access to all routes
  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
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
          <Route path="/" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><HomePage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/profiles" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><ProfilesPage /></PageWrapper>
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
          {/* <Route path="/calibration" element={
            <ProtectedRoute>
              <Suspense fallback={<InlineLoader />}>
                <PageWrapper><CalibrationPage /></PageWrapper>
              </Suspense>
            </ProtectedRoute>
          } /> */}
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
