export const PRIVACY_STORAGE_KEY = 'worthlog-privacy-mode';

export type PrivacyMode = 'visible' | 'hidden';

export function readPrivacyMode(): PrivacyMode {
  if (typeof window === 'undefined') {
    return 'visible';
  }

  try {
    return window.localStorage.getItem(PRIVACY_STORAGE_KEY) === 'hidden'
      ? 'hidden'
      : 'visible';
  } catch {
    return 'visible';
  }
}

export function writePrivacyMode(mode: PrivacyMode): void {
  try {
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, mode);
  } catch {
    // Ignore quota / private-mode write failures.
  }
}

export function applyPrivacyMode(mode: PrivacyMode): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (mode === 'hidden') {
    document.documentElement.dataset['privacy'] = 'hidden';
  } else {
    delete document.documentElement.dataset['privacy'];
  }
}

export function isPrivacyHidden(mode: PrivacyMode): boolean {
  return mode === 'hidden';
}
