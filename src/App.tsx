import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navigation } from './components/Navigation';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { Dashboard } from './components/Dashboard/Dashboard';
import { useAuth } from './contexts/AuthContext';
import { CallNotification } from './components/Call/CallNotification';
import { ref, onValue, remove } from 'firebase/database';
import { db } from './config/firebase';
import { ChatContainer } from './components/Chat/ChatContainer';
import { ChatPage } from './components/Chat/ChatPage';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return currentUser ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" state={{ from: location }} replace />
  );
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return currentUser ? (
    <Navigate to={(location.state as any)?.from?.pathname || '/dashboard'} replace />
  ) : (
    <>{children}</>
  );
};

const AppContent: React.FC = () => {
  const [incomingCall, setIncomingCall] = React.useState<any>(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!currentUser) return;

    const incomingCallRef = ref(db, `users/${currentUser.uid}/incomingCall`);
    const unsubscribe = onValue(incomingCallRef, (snapshot) => {
      if (snapshot.exists()) {
        setIncomingCall(snapshot.val());
        setTimeout(() => {
          remove(incomingCallRef);
          setIncomingCall(null);
        }, 30000);
      } else {
        setIncomingCall(null);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleAcceptCall = async () => {
    if (!incomingCall) return;
    navigate(`/chat/${incomingCall.callId}`);
    await remove(ref(db, `users/${currentUser?.uid}/incomingCall`));
    setIncomingCall(null);
  };

  const handleRejectCall = async () => {
    if (!incomingCall || !currentUser) return;
    await remove(ref(db, `users/${currentUser.uid}/incomingCall`));
    setIncomingCall(null);
  };

  return (
    <>
      {incomingCall && (
        <CallNotification
          caller={{
            displayName: incomingCall.callerName,
            callType: incomingCall.callType
          }}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}
      <div className="min-h-screen bg-gray-100">
        <Navigation />
        <main className="pt-16">
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicRoute>
                  <Signup />
                </PublicRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/chat/:chatId"
              element={
                <PrivateRoute>
                  <ChatPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/"
              element={<Navigate to="/dashboard" replace />}
            />
            <Route
              path="*"
              element={
                <div className="flex items-center justify-center min-h-screen">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900">
                      404 - Page Not Found
                    </h2>
                    <p className="mt-2 text-gray-600">
                      The page you're looking for doesn't exist.
                    </p>
                  </div>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;