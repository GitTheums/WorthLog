import { Moon, Plus, Settings, Sun } from 'lucide-react';
import type { Theme } from '../hooks/useTheme';
import './Header.css';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
  onAddSnapshot: () => void;
  onOpenSettings: () => void;
}

export function Header({
  theme,
  onToggleTheme,
  onAddSnapshot,
  onOpenSettings,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__mark" aria-hidden="true">
          <span className="app-header__mark-bar" />
          <span className="app-header__mark-bar app-header__mark-bar--mid" />
          <span className="app-header__mark-bar app-header__mark-bar--tall" />
        </span>
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
        >
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
          Add snapshot
        </button>

        <button
          type="button"
          className="app-header__icon-button"
          onClick={onToggleTheme}
          aria-label={
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
        >
          <Settings size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
