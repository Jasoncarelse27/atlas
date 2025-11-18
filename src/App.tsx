import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "sonner";
import { Navigate, Route, BrowserRouter as Router, Routes, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoadingSpinner from "./components/LoadingSpinner";
import { UpgradeModalProvider } from "./contexts/UpgradeModalContext";
import { TutorialProvider } from "./contexts/TutorialContext";
import { AuthProvider, useAuth } from "./providers/AuthProvider";
import { useSettingsStore } from "./stores/useSettingsStore";
import { setGlobalNavigate } from "./utils/navigation";
import { TutorialOverlay } from "./components/tutorial/TutorialOverlay";

// 🚀 Route-based code splitting for better performance
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const UpgradePage = lazy(() => import("./pages/UpgradePage"));
const SubscriptionSuccess = lazy(() => import("./pages/SubscriptionSuccess"));
const SubscriptionCancel = lazy(() => import("./pages/SubscriptionCancel"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const RitualLibrary = lazy(() => import("./features/rituals/components/RitualLibrary").then(m => ({ default: m.RitualLibrary })));
const RitualBuilder = lazy(() => import("./features/rituals/components/RitualBuilder").then(m => ({ default: m.RitualBuilder })));
const RitualRunView = lazy(() => import("./features/rituals/components/RitualRunView").then(m => ({ default: m.RitualRunView })));
const RitualInsightsDashboard = lazy(() => import("./features/rituals/components/RitualInsightsDashboard").then(m => ({ default: m.RitualInsightsDashboard })));

// 🚀 Production-grade Query Client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 3,
    },
  },
});

function ProtectedChatRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ErrorBoundary>
      <ChatPage user={user} />
    </ErrorBoundary>
  );
}

function PublicAuthRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (user) return <Navigate to="/chat" replace />;

  return <AuthPage />;
}

function ProtectedRitualRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ErrorBoundary>
      <RitualLibrary />
    </ErrorBoundary>
  );
}

function ProtectedRitualBuilderRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ErrorBoundary>
      <RitualBuilder />
    </ErrorBoundary>
  );
}

function ProtectedRitualRunRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ErrorBoundary>
      <RitualRunView />
    </ErrorBoundary>
  );
}

function ProtectedRitualInsightsRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ErrorBoundary>
      <RitualInsightsDashboard />
    </ErrorBoundary>
  );
}

// Component to set up global navigation
function NavigationSetup() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Set global navigate function for utility functions
    setGlobalNavigate(navigate);
    if (typeof window !== 'undefined') {
      (window as any).__atlasNavigate = navigate;
    }
  }, [navigate]);
  
  return null;
}

function App() {
  // Initialize settings from localStorage on app load
  useEffect(() => {
    useSettingsStore.getState().initializeSettings();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UpgradeModalProvider>
          <TutorialProvider>
                    <Router>
                      <NavigationSetup />
                      <Toaster position="top-center" />
                      <ErrorBoundary>
                        <TutorialOverlay />
                      </ErrorBoundary>
                      <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/login" element={<PublicAuthRoute />} />
                  <Route path="/chat" element={<ProtectedChatRoute />} />
                  <Route path="/rituals" element={<ProtectedRitualRoute />} />
                  <Route path="/rituals/builder" element={<ProtectedRitualBuilderRoute />} />
                  <Route path="/rituals/run/:ritualId" element={<ProtectedRitualRunRoute />} />
                  <Route path="/rituals/insights" element={<ProtectedRitualInsightsRoute />} />
                  <Route path="/upgrade" element={<UpgradePage />} />
                  <Route path="/subscription/success" element={<SubscriptionSuccess />} />
                  <Route path="/subscription/cancel" element={<SubscriptionCancel />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/" element={<Navigate to="/chat" replace />} />
                  <Route path="*" element={<Navigate to="/chat" replace />} />
                </Routes>
              </Suspense>
            </Router>
          </TutorialProvider>
        </UpgradeModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;