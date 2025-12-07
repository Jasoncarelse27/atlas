import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoadingSpinner from "./components/LoadingSpinner";
import { TutorialOverlay } from "./components/tutorial/TutorialOverlay";
import { TutorialProvider } from "./contexts/TutorialContext";
import { UpgradeModalProvider } from "./contexts/UpgradeModalContext";
import { atlasDB } from "./database/atlasDB";
import { useTierQuery } from "./hooks/useTierQuery";
import { logger } from "./lib/logger";
import { AuthProvider, useAuth } from "./providers/AuthProvider";
import { useSettingsStore } from "./stores/useSettingsStore";
import { navigateToLastConversation } from "./utils/chatNavigation";
import { handleLaunchUrl } from "./utils/handleLaunchUrl";
import { setGlobalNavigate } from "./utils/navigation";
import { ReactQueryDevtoolsWrapper } from "./components/ReactQueryDevtoolsWrapper";
import { supabase } from './lib/supabaseClient';

// 🚀 Route-based code splitting for better performance
// ✅ SAFE LAZY LOADING: Wrapped with error handling and validation
const safeLazy = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> => {
  return lazy(async () => {
    try {
      const module = await importFn();
      if (!module?.default) {
        const error = new Error('Lazy import failed: module.default is undefined');
        logger.error('[App] Lazy import validation failed:', error);
        throw error;
      }
      // Validate that default export is a valid React component
      if (typeof module.default !== 'function') {
        const error = new Error(`Lazy import failed: module.default is not a function (got ${typeof module.default})`);
        logger.error('[App] Lazy import validation failed:', error);
        throw error;
      }
      return module;
    } catch (error) {
      logger.error('[App] Lazy import failed:', error);
      // Re-throw to let React's error boundary handle it
      throw error;
    }
  });
};

const AuthPage = safeLazy(() => import("./pages/AuthPage"));
const ChatPage = safeLazy(() => import("./pages/ChatPage"));
const UpgradePage = safeLazy(() => import("./pages/UpgradePage"));
const SubscriptionSuccess = safeLazy(() => import("./pages/SubscriptionSuccess"));
const SubscriptionCancel = safeLazy(() => import("./pages/SubscriptionCancel"));
const TermsPage = safeLazy(() => import("./pages/TermsPage"));
const PrivacyPage = safeLazy(() => import("./pages/PrivacyPage"));
const RitualLibrary = safeLazy(() => import("./features/rituals/components/RitualLibrary").then(m => ({ default: m.RitualLibrary })));
const RitualBuilder = safeLazy(() => import("./features/rituals/components/RitualBuilder").then(m => ({ default: m.RitualBuilder })));
const RitualRunView = safeLazy(() => import("./features/rituals/components/RitualRunView").then(m => ({ default: m.RitualRunView })));
const RitualInsightsDashboard = safeLazy(() => import("./features/rituals/components/RitualInsightsDashboard").then(m => ({ default: m.RitualInsightsDashboard })));
const BillingDashboard = safeLazy(() => import("./pages/BillingDashboard"));
const AgentsPage = safeLazy(() => import("./pages/AgentsPage"));
const BusinessPerformancePage = safeLazy(() => import("./pages/BusinessPerformancePage"));
const ResetPasswordPage = safeLazy(() => import("./pages/ResetPasswordPage"));

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
      <Suspense fallback={<LoadingSpinner />}>
        <ChatPage user={user} />
      </Suspense>
    </ErrorBoundary>
  );
}

function PublicAuthRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (user) return <Navigate to="/chat" replace />;

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AuthPage />
    </Suspense>
  );
}

function ProtectedRitualRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <RitualLibrary />
      </Suspense>
    </ErrorBoundary>
  );
}

function ProtectedRitualBuilderRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <RitualBuilder />
      </Suspense>
    </ErrorBoundary>
  );
}

function ProtectedRitualRunRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <RitualRunView />
      </Suspense>
    </ErrorBoundary>
  );
}

function ProtectedRitualInsightsRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <RitualInsightsDashboard />
      </Suspense>
    </ErrorBoundary>
  );
}

function ProtectedBillingRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <BillingDashboard />
      </Suspense>
    </ErrorBoundary>
  );
}

function ProtectedAgentsRoute() {
  const { user, loading } = useAuth();
  const [isAuthorized, setIsAuthorized] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setIsAuthorized(false);
        return;
      }

      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const email = authUser?.email?.toLowerCase() || '';
        
        // ✅ RESTRICTED: Only Rima and Jason can access
        const allowedEmails = [
          'rima@otiumcreations.com',
          'jason@otiumcreations.com', 
          'jasonc.jpg@gmail.com'
        ];
        
        const isAllowed = allowedEmails.some(allowed => 
          email === allowed.toLowerCase() || email.includes(allowed.split('@')[0])
        );
        
        setIsAuthorized(isAllowed);
      } catch (error) {
        logger.error('[ProtectedAgentsRoute] Access check failed:', error);
        setIsAuthorized(false);
      }
    };

    if (user) {
      checkAccess();
    }
  }, [user]);

  if (loading || isAuthorized === null) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#F4E5D9] dark:bg-gray-900">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Access Restricted
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            This dashboard is only available to authorized users.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <AgentsPage />
      </Suspense>
    </ErrorBoundary>
  );
}

function ProtectedBusinessPerformanceRoute() {
  const { user, loading } = useAuth();
  const [isAuthorized, setIsAuthorized] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setIsAuthorized(false);
        return;
      }

      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const email = authUser?.email?.toLowerCase() || '';
        
        // ✅ RESTRICTED: Only Rima and Jason can access
        const allowedEmails = [
          'rima@otiumcreations.com',
          'jason@otiumcreations.com', 
          'jasonc.jpg@gmail.com'
        ];
        
        const isAllowed = allowedEmails.some(allowed => 
          email === allowed.toLowerCase() || email.includes(allowed.split('@')[0])
        );
        
        setIsAuthorized(isAllowed);
      } catch (error) {
        logger.error('[ProtectedBusinessPerformanceRoute] Access check failed:', error);
        setIsAuthorized(false);
      }
    };

    if (user) {
      checkAccess();
    }
  }, [user]);

  if (loading || isAuthorized === null) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#F4E5D9] dark:bg-gray-900">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Access Restricted
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            This dashboard is only available to authorized users.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <BusinessPerformancePage />
      </Suspense>
    </ErrorBoundary>
  );
}

// Component to auto-load last conversation on startup (ChatGPT-style)
function AutoLoadLastConversation() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); // ✅ FIX: Add location hook

  useEffect(() => {
    if (loading || !user) return;

    // ✅ CRITICAL FIX: Only auto-redirect on root or chat routes
    // Prevents hijacking navigation to /billing, /rituals, /settings, etc.
    const isChatRoute = location.pathname === '/' || location.pathname.startsWith('/chat');
    if (!isChatRoute) {
      logger.debug('[Startup] Skipping auto-load - not on chat route:', location.pathname);
      return;
    }

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

        // 3. No conversations → use navigateToLastConversation (will create new if needed)
        logger.debug('[Startup] No history found — navigating to last conversation');
        navigateToLastConversation(navigate);
      } catch (err) {
        logger.warn('[Startup] Failed to auto-load last conversation', { err });
        navigateToLastConversation(navigate);
      }
    })();
  }, [loading, user, navigate, location.pathname]); // ✅ FIX: Add location.pathname to deps

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
                            <Route path="/agents" element={<ProtectedAgentsRoute />} />
                            <Route path="/business-performance" element={<ProtectedBusinessPerformanceRoute />} />
                            <Route path="/upgrade" element={<Suspense fallback={<LoadingSpinner />}><UpgradePage /></Suspense>} />
                            <Route path="/subscription/success" element={<Suspense fallback={<LoadingSpinner />}><SubscriptionSuccess /></Suspense>} />
                            <Route path="/subscription/cancel" element={<Suspense fallback={<LoadingSpinner />}><SubscriptionCancel /></Suspense>} />
                            <Route path="/terms" element={<Suspense fallback={<LoadingSpinner />}><TermsPage /></Suspense>} />
                            <Route path="/privacy" element={<Suspense fallback={<LoadingSpinner />}><PrivacyPage /></Suspense>} />
                            <Route path="/reset-password" element={<Suspense fallback={<LoadingSpinner />}><ResetPasswordPage /></Suspense>} />
                            <Route path="/" element={<Navigate to="/chat" replace />} />
                            <Route path="*" element={<Navigate to="/chat" replace />} />
                          </Routes>
                        </Suspense>
                      </ErrorBoundary>
            </Router>
          </TutorialProvider>
        </UpgradeModalProvider>
      </AuthProvider>
      {/* ✅ PRODUCTION-SAFE: Devtools wrapper handles conditional loading */}
      <ReactQueryDevtoolsWrapper />
    </QueryClientProvider>
  );
}

export default App;