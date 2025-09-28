import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingSpinner from "./components/LoadingSpinner";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import UpgradePage from "./pages/UpgradePage";
import { AuthProvider, useAuth } from "./providers/AuthProvider";

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
        <Router>
          <Toaster position="top-center" />
          <Routes>
            <Route path="/login" element={<PublicAuthRoute />} />
            <Route path="/chat" element={<ProtectedChatRoute />} />
            <Route path="/upgrade" element={<UpgradePage />} />
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;