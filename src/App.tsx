import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoadingSpinner from "./components/LoadingSpinner";
import { UpgradeModalProvider } from "./contexts/UpgradeModalContext";
import { AuthProvider, useAuth } from "./providers/AuthProvider";
import { useSettingsStore } from "./stores/useSettingsStore";

// 🚀 Route-based code splitting for better performance
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const UpgradePage = lazy(() => import("./pages/UpgradePage"));
const RitualLibrary = lazy(() => import("./features/rituals/components/RitualLibrary").then(m => ({ default: m.RitualLibrary})));
const RitualBuilder = lazy(() => import("./features/rituals/components/RitualBuilder").then(m => ({ default: m.RitualBuilder})));

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

function App() {
  // Initialize settings from localStorage on app load
  useEffect(() => {
    useSettingsStore.getState().initializeSettings();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UpgradeModalProvider>
          <Router>
            <Toaster position="top-center" />
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/login" element={<PublicAuthRoute />} />
                <Route path="/chat" element={<ProtectedChatRoute />} />
                <Route path="/rituals" element={<ProtectedRitualRoute />} />
                <Route path="/rituals/builder" element={<ProtectedRitualBuilderRoute />} />
                <Route path="/upgrade" element={<UpgradePage />} />
                <Route path="/" element={<Navigate to="/chat" replace />} />
                <Route path="*" element={<Navigate to="/chat" replace />} />
              </Routes>
            </Suspense>
          </Router>
        </UpgradeModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;