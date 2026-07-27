import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { PrivacyModeProvider } from '../privacy/PrivacyModeProvider';

function Providers({ children }: { children: ReactNode }) {
  return <PrivacyModeProvider>{children}</PrivacyModeProvider>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, {
    ...options,
    wrapper: Providers,
  });
}
