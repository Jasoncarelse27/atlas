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
import { handleLaunchUrl } from "./utils/handleLaunchUrl";
import { useTierQuery } from "./hooks/useTierQuery";
import { atlasDB } from "./database/atlasDB";
import { logger } from "./lib/logger";

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
const BillingDashboard = lazy(() => import("./pages/BillingDashboard"));

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

function ProtectedBillingRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ErrorBoundary>
      <BillingDashboard />
    </ErrorBoundary>
  );
}

// Component to auto-load last conversation on startup (ChatGPT-style)
function AutoLoadLastConversation() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;

    (async () => {
      try {
        // 1. Try Dexie appState
        const last = await atlasDB.appState.get('lastOpenedConversationId');

        if (last?.value) {
          logger.debug('[Startup] Auto-loading last conversation from appState', {
            id: last.value,
          });
          navigate(`/chat?conversation=${last.value}`, { replace: true });
          return;
        }

        // 2. Fallback: most recent conversation by updatedAt (filtered by userId)
        const lastConv = await atlasDB.conversations
          .where('userId')
          .equals(user.id)
          .sortBy('updatedAt')
          .then(convs => convs.length > 0 ? convs[convs.length - 1] : null);

        if (lastConv?.id) {
          logger.debug('[Startup] Auto-loading most recent conversation', {
            id: lastConv.id,
          });
          navigate(`/chat?conversation=${lastConv.id}`, { replace: true });
          return;
        }

        // 3. No conversations → go to /chat (new chat)
        logger.debug('[Startup] No history found — starting new conversation');
        navigate('/chat', { replace: true });
      } catch (err) {
        logger.warn('[Startup] Failed to auto-load last conversation', { err });
        navigate('/chat', { replace: true });
      }
    })();
  }, [loading, user, navigate]);

  return null;
}

// Component to set up global navigation and deep link handling
function NavigationSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { forceRefresh } = useTierQuery();
  
  useEffect(() => {
    // Set global navigate function for utility functions
    setGlobalNavigate(navigate);
    if (typeof window !== 'undefined') {
      (window as any).__atlasNavigate = navigate;
    }
  }, [navigate]);

  // Handle deep links after authentication check
  useEffect(() => {
    // Only handle deep links if user is authenticated (or on public routes)
    // This ensures deep links work correctly after login
    if (user !== undefined) {
      // Small delay to ensure routing is ready
      const timeoutId = setTimeout(() => {
        handleLaunchUrl({
          navigate,
          refreshTier: forceRefresh,
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [navigate, user, forceRefresh]);
  
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
                      <AutoLoadLastConversation />
                      <NavigationSetup />
                      <Toaster position="top-center" />
                      <ErrorBoundary>
                        <TutorialOverlay />
                      </ErrorBoundary>
                      <ErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                          <Routes>
                            <Route path="/login" element={<PublicAuthRoute />} />
                            <Route path="/chat" element={<ProtectedChatRoute />} />
                            <Route path="/rituals" element={<ProtectedRitualRoute />} />
                            <Route path="/rituals/builder" element={<ProtectedRitualBuilderRoute />} />
                            <Route path="/rituals/run/:ritualId" element={<ProtectedRitualRunRoute />} />
                            <Route path="/rituals/insights" element={<ProtectedRitualInsightsRoute />} />
                            <Route path="/billing" element={<ProtectedBillingRoute />} />
                            <Route path="/upgrade" element={<UpgradePage />} />
                            <Route path="/subscription/success" element={<SubscriptionSuccess />} />
                            <Route path="/subscription/cancel" element={<SubscriptionCancel />} />
                            <Route path="/terms" element={<TermsPage />} />
                            <Route path="/privacy" element={<PrivacyPage />} />
                            <Route path="/" element={<Navigate to="/chat" replace />} />
                            <Route path="*" element={<Navigate to="/chat" replace />} />
                          </Routes>
                        </Suspense>
                      </ErrorBoundary>
            </Router>
          </TutorialProvider>
        </UpgradeModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;