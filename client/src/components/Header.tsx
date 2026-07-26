import { Eye, EyeOff, Moon, Plus, Settings, Sun } from 'lucide-react';
import type { Theme } from '../hooks/useTheme';
import { BrandMark } from './BrandMark';
import './Header.css';

interface HeaderProps {
  theme: Theme;
  privacyHidden: boolean;
  onToggleTheme: () => void;
  onTogglePrivacy: () => void;
  onAddSnapshot: () => void;
  onOpenSettings: () => void;
}

export function Header({
  theme,
  privacyHidden,
  onToggleTheme,
  onTogglePrivacy,
  onAddSnapshot,
  onOpenSettings,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <BrandMark />
        <div className="app-header__titles">
          <h1 className="app-header__name">Worthlog</h1>
          <p className="app-header__subtitle">Personal investment history</p>
        </div>
      </div>

      <div className="app-header__actions">
        <button
          type="button"
          className="app-header__primary"
          onClick={onAddSnapshot}
          aria-label="Add snapshot"
        >
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
          <span className="app-header__primary-label">Add snapshot</span>
        </button>

        <button
          type="button"
          className="app-header__icon-button"
          onClick={onTogglePrivacy}
          aria-label={
            privacyHidden ? 'Show monetary values' : 'Hide monetary values'
          }
          aria-pressed={privacyHidden}
          title={
            privacyHidden ? 'Show monetary values' : 'Hide monetary values'
          }
        >
          {privacyHidden ? (
            <EyeOff size={18} strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <Eye size={18} strokeWidth={1.8} aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          className="app-header__icon-button"
          onClick={onToggleTheme}
          aria-label={
            theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
          }
          title={
            theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
          }
        >
          {theme === 'light' ? (
            <Moon size={18} strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <Sun size={18} strokeWidth={1.8} aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          className="app-header__icon-button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Open settings"
        >
          <Settings size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
