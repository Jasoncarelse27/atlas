import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { Toaster } from "react-hot-toast";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoadingSpinner from "./components/LoadingSpinner";
import { TierProvider } from "./contexts/TierContext";
import { AuthProvider, useAuth } from "./providers/AuthProvider";

// 🚀 Route-based code splitting for better performance
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const UpgradePage = lazy(() => import("./pages/UpgradePage"));

const queryClient = new QueryClient();

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TierProvider>
          <Router>
            <Toaster position="top-center" />
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/login" element={<PublicAuthRoute />} />
                <Route path="/chat" element={<ProtectedChatRoute />} />
                <Route path="/upgrade" element={<UpgradePage />} />
                <Route path="/" element={<Navigate to="/chat" replace />} />
                <Route path="*" element={<Navigate to="/chat" replace />} />
              </Routes>
            </Suspense>
          </Router>
        </TierProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;