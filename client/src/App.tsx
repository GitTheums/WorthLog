import { Dashboard } from './Dashboard';
import { PrivacyModeProvider } from './privacy/PrivacyModeContext';

export function App() {
  return (
    <PrivacyModeProvider>
      <Dashboard />
    </PrivacyModeProvider>
  );
}
