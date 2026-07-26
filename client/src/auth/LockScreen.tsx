import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { ApiError, getApiErrorRetryAfterSeconds } from '../api/client';
import { BrandMark } from '../components/BrandMark';
import { useAuth } from './AuthContext';
import './LockScreen.css';

export function LockScreen() {
  const { unlock } = useAuth();
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRetryAfter((value) => {
        if (value === null || value <= 1) {
          setError(null);
          return null;
        }
        const next = value - 1;
        setError(`Too many attempts. Try again in ${String(next)} seconds.`);
        return next;
      });
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [retryAfter]);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || (retryAfter !== null && retryAfter > 0)) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await unlock(pin);
      setPin('');
    } catch (caught) {
      setPin('');
      const retry = getApiErrorRetryAfterSeconds(caught);
      if (retry !== null && retry > 0) {
        setRetryAfter(retry);
        setError(
          `Too many attempts. Try again in ${String(retry)} seconds.`,
        );
      } else if (
        caught instanceof ApiError &&
        (caught.code === 'RATE_LIMITED' || caught.code === 'TOO_MANY_ATTEMPTS')
      ) {
        setError('Too many attempts. Please try again later.');
      } else if (caught instanceof ApiError && caught.code === 'INVALID_PIN') {
        setError('That PIN is incorrect.');
      } else if (caught instanceof Error) {
        setError(caught.message);
      } else {
        setError('That PIN is incorrect.');
      }
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } finally {
      setBusy(false);
    }
  };

  const blocked = retryAfter !== null && retryAfter > 0;

  return (
    <div className="lock-screen">
      <div className="lock-screen__panel">
        <div className="lock-screen__brand">
          <BrandMark className="lock-screen__mark" />
          <p className="lock-screen__name">Worthlog</p>
        </div>

        <h1 className="lock-screen__heading">Portfolio locked</h1>
        <p className="lock-screen__text">Enter your PIN to continue.</p>

        <form className="lock-screen__form" onSubmit={(event) => void submit(event)}>
          <label className="lock-screen__label" htmlFor={inputId}>
            PIN
          </label>
          <input
            ref={inputRef}
            id={inputId}
            className="lock-screen__input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            autoComplete="current-password"
            value={pin}
            disabled={busy || blocked}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              const digits = event.target.value.replaceAll(/\D/g, '').slice(0, 8);
              setPin(digits);
              if (error && !blocked) {
                setError(null);
              }
            }}
          />

          {error ? (
            <p id={errorId} className="lock-screen__error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="lock-screen__submit"
            disabled={busy || blocked || pin.length < 4}
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}
