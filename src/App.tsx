import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import NotificationToast from "./components/NotificationToast";
import Sidebar from "./components/Sidebar";
import { useNotifications } from "./hooks/useNotifications";
import InboxPage from "./pages/InboxPage";
import LoginPage from "./pages/LoginPage";
import SchedulePage from "./pages/SchedulePage";

function AppShell() {
  const { isAuthenticated, isLoading } = useAuth();
  const { notifications, dismiss } = useNotifications(isAuthenticated);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading LipCoding…
      </div>
    );
  }

  return (
    <>
      <NotificationToast notifications={notifications} onDismiss={dismiss} />
      {!isAuthenticated ? (
        <LoginPage />
      ) : (
        <div className="flex h-screen bg-gray-50 text-gray-900">
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<InboxPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/search" element={<InboxPage />} />
            </Routes>
          </main>
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppShell />
      </Router>
    </AuthProvider>
  );
}

export default App;
