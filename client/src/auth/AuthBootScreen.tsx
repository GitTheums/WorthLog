import { BrandMark } from '../components/BrandMark';
import './LockScreen.css';

/** Neutral loading shell while auth status is checked (no private data). */
export function AuthBootScreen() {
  return (
    <div className="lock-screen" aria-busy="true" aria-live="polite">
      <div className="lock-screen__panel">
        <div className="lock-screen__brand">
          <BrandMark className="lock-screen__mark" />
          <p className="lock-screen__name">Worthlog</p>
        </div>
        <p className="lock-screen__text">Loading…</p>
      </div>
    </div>
  );
}
