import { AuthBootScreen } from './auth/AuthBootScreen';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LockScreen } from './auth/LockScreen';
import './auth/LockScreen.css';
import { Dashboard } from './Dashboard';
import { ErrorState } from './components/ErrorState';
import { PrivacyModeProvider } from './privacy/PrivacyModeContext';

function AuthenticatedApp() {
  const { loading, error, unlocked, refreshStatus } = useAuth();

  if (loading) {
    return <AuthBootScreen />;
  }

  if (error && !unlocked) {
    return (
      <div className="lock-screen">
        <div className="lock-screen__panel">
          <ErrorState
            title="Could not check lock status"
            message={error}
            onRetry={() => {
              void refreshStatus();
            }}
          />
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return <LockScreen />;
  }

  return <Dashboard />;
}

export function App() {
  return (
    <PrivacyModeProvider>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </PrivacyModeProvider>
  );
}
