import { useEffect, useId, useState, type SyntheticEvent } from 'react';
import {
  ApiError,
  changePin,
  removePin,
  setupPin,
} from '../../api/client';
import { useAuth } from '../../auth/useAuth';

interface SecuritySettingsProps {
  onToast: (tone: 'success' | 'error', message: string) => void;
  onLockNow: () => void;
  onCloseSettings: () => void;
}

function isValidPin(value: string): boolean {
  return /^\d{4,8}$/.test(value);
}

export function SecuritySettings({
  onToast,
  onLockNow,
  onCloseSettings,
}: SecuritySettingsProps) {
  const { pinEnabled, applyStatus } = useAuth();
  const newPinId = useId();
  const confirmPinId = useId();
  const currentPinId = useId();
  const changeNewPinId = useId();
  const changeConfirmPinId = useId();
  const removePinId = useId();

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [enableErrors, setEnableErrors] = useState<Record<string, string>>({});
  const [enableBusy, setEnableBusy] = useState(false);
  const [enableSuccess, setEnableSuccess] = useState<string | null>(null);

  const [changeOpen, setChangeOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [changeNewPin, setChangeNewPin] = useState('');
  const [changeConfirmPin, setChangeConfirmPin] = useState('');
  const [changeErrors, setChangeErrors] = useState<Record<string, string>>({});
  const [changeBusy, setChangeBusy] = useState(false);

  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeCurrentPin, setRemoveCurrentPin] = useState('');
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  useEffect(() => {
    if (!pinEnabled) {
      setChangeOpen(false);
      setRemoveOpen(false);
    }
  }, [pinEnabled]);

  const digitsOnly = (value: string) => value.replaceAll(/\D/g, '').slice(0, 8);

  const handleEnable = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enableBusy) {
      return;
    }

    const errors: Record<string, string> = {};
    if (!isValidPin(newPin)) {
      errors['newPin'] = 'PIN must be 4 to 8 digits.';
    }
    if (newPin !== confirmPin) {
      errors['confirmPin'] = 'PIN confirmation does not match.';
    }
    setEnableErrors(errors);
    setEnableSuccess(null);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setEnableBusy(true);
    try {
      const status = await setupPin(newPin);
      applyStatus(status);
      setNewPin('');
      setConfirmPin('');
      setEnableSuccess('PIN protection enabled');
      onToast('success', 'PIN protection enabled');
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'Could not enable PIN';
      setEnableErrors({ form: message });
      onToast('error', message);
    } finally {
      setEnableBusy(false);
    }
  };

  const handleChangePin = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (changeBusy) {
      return;
    }

    const errors: Record<string, string> = {};
    if (!isValidPin(currentPin)) {
      errors['currentPin'] = 'Current PIN must be 4 to 8 digits.';
    }
    if (!isValidPin(changeNewPin)) {
      errors['newPin'] = 'New PIN must be 4 to 8 digits.';
    }
    if (changeNewPin !== changeConfirmPin) {
      errors['confirmPin'] = 'New PIN confirmation does not match.';
    }
    if (
      isValidPin(currentPin) &&
      isValidPin(changeNewPin) &&
      currentPin === changeNewPin
    ) {
      errors['newPin'] = 'New PIN must be different from the current PIN.';
    }
    setChangeErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setChangeBusy(true);
    try {
      const status = await changePin(currentPin, changeNewPin);
      applyStatus(status);
      setCurrentPin('');
      setChangeNewPin('');
      setChangeConfirmPin('');
      setChangeOpen(false);
      onToast('success', 'PIN updated');
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'Could not change PIN';
      setChangeErrors({ form: message });
    } finally {
      setChangeBusy(false);
    }
  };

  const handleRemovePin = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (removeBusy) {
      return;
    }
    if (!isValidPin(removeCurrentPin)) {
      setRemoveError('Current PIN must be 4 to 8 digits.');
      return;
    }

    setRemoveBusy(true);
    setRemoveError(null);
    try {
      const status = await removePin(removeCurrentPin);
      applyStatus(status);
      setRemoveCurrentPin('');
      setRemoveOpen(false);
      onToast('success', 'PIN protection removed');
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'Could not remove PIN';
      setRemoveError(message);
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <section className="settings-section" aria-label="Security">
      <p className="settings-section__intro">
        Optional PIN protection restricts access through the Worthlog web
        interface and API. It does not encrypt your SQLite database.
      </p>

      {!pinEnabled ? (
        <form
          className="settings-card settings-form"
          onSubmit={(event) => {
            void handleEnable(event);
          }}
        >
          <h3 className="settings-card__title">Portfolio PIN</h3>
          <p className="settings-muted">
            Require a PIN before portfolio data can be viewed on this device or
            network.
          </p>
          <p className="settings-hint">
            A PIN helps prevent casual access to WorthLog, but it does not
            encrypt your database or replace HTTPS, a VPN, or proper network
            security.
          </p>

          <div className="settings-field">
            <label htmlFor={newPinId}>New PIN</label>
            <input
              id={newPinId}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              autoComplete="new-password"
              value={newPin}
              onChange={(event) => {
                setNewPin(digitsOnly(event.target.value));
              }}
            />
            {enableErrors['newPin'] ? (
              <p className="settings-error" role="alert">
                {enableErrors['newPin']}
              </p>
            ) : null}
          </div>

          <div className="settings-field">
            <label htmlFor={confirmPinId}>Confirm PIN</label>
            <input
              id={confirmPinId}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              autoComplete="new-password"
              value={confirmPin}
              onChange={(event) => {
                setConfirmPin(digitsOnly(event.target.value));
              }}
            />
            {enableErrors['confirmPin'] ? (
              <p className="settings-error" role="alert">
                {enableErrors['confirmPin']}
              </p>
            ) : null}
          </div>

          {enableErrors['form'] ? (
            <p className="settings-error" role="alert">
              {enableErrors['form']}
            </p>
          ) : null}
          {enableSuccess ? (
            <p className="settings-success" role="status">
              {enableSuccess}
            </p>
          ) : null}

          <div className="settings-form-actions">
            <button
              type="submit"
              className="settings-button settings-button--primary"
              disabled={enableBusy}
            >
              {enableBusy ? 'Enabling…' : 'Enable PIN'}
            </button>
          </div>
        </form>
      ) : (
        <div className="settings-card">
          <h3 className="settings-card__title">Portfolio PIN</h3>
          <p className="settings-success" role="status">
            PIN protection is enabled
          </p>
          <p className="settings-hint">
            A PIN helps prevent casual access to WorthLog, but it does not
            encrypt your database or replace HTTPS, a VPN, or proper network
            security. Anyone with filesystem access can still read{' '}
            <code>worthlog.db</code>. Prefer HTTPS or a VPN for remote access.
          </p>

          <div className="settings-backup-actions">
            <button
              type="button"
              className="settings-button settings-button--primary"
              onClick={() => {
                onCloseSettings();
                onLockNow();
              }}
            >
              Lock now
            </button>
            <button
              type="button"
              className="settings-button settings-button--ghost"
              onClick={() => {
                setChangeOpen(true);
                setChangeErrors({});
                setCurrentPin('');
                setChangeNewPin('');
                setChangeConfirmPin('');
              }}
            >
              Change PIN
            </button>
            <button
              type="button"
              className="settings-button settings-button--danger"
              onClick={() => {
                setRemoveOpen(true);
                setRemoveError(null);
                setRemoveCurrentPin('');
              }}
            >
              Remove PIN
            </button>
          </div>

          {changeOpen ? (
            <form
              className="settings-form"
              style={{ marginTop: '1.25rem' }}
              onSubmit={(event) => {
                void handleChangePin(event);
              }}
            >
              <h4 className="settings-card__title">Change PIN</h4>
              <div className="settings-field">
                <label htmlFor={currentPinId}>Current PIN</label>
                <input
                  id={currentPinId}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  autoComplete="current-password"
                  value={currentPin}
                  onChange={(event) => {
                    setCurrentPin(digitsOnly(event.target.value));
                  }}
                />
                {changeErrors['currentPin'] ? (
                  <p className="settings-error" role="alert">
                    {changeErrors['currentPin']}
                  </p>
                ) : null}
              </div>
              <div className="settings-field">
                <label htmlFor={changeNewPinId}>New PIN</label>
                <input
                  id={changeNewPinId}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  autoComplete="new-password"
                  value={changeNewPin}
                  onChange={(event) => {
                    setChangeNewPin(digitsOnly(event.target.value));
                  }}
                />
                {changeErrors['newPin'] ? (
                  <p className="settings-error" role="alert">
                    {changeErrors['newPin']}
                  </p>
                ) : null}
              </div>
              <div className="settings-field">
                <label htmlFor={changeConfirmPinId}>Confirm new PIN</label>
                <input
                  id={changeConfirmPinId}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  autoComplete="new-password"
                  value={changeConfirmPin}
                  onChange={(event) => {
                    setChangeConfirmPin(digitsOnly(event.target.value));
                  }}
                />
                {changeErrors['confirmPin'] ? (
                  <p className="settings-error" role="alert">
                    {changeErrors['confirmPin']}
                  </p>
                ) : null}
              </div>
              {changeErrors['form'] ? (
                <p className="settings-error" role="alert">
                  {changeErrors['form']}
                </p>
              ) : null}
              <div className="settings-form-actions">
                <button
                  type="button"
                  className="settings-button settings-button--ghost"
                  disabled={changeBusy}
                  onClick={() => {
                    setChangeOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="settings-button settings-button--primary"
                  disabled={changeBusy}
                >
                  {changeBusy ? 'Updating…' : 'Update PIN'}
                </button>
              </div>
            </form>
          ) : null}

          {removeOpen ? (
            <form
              className="settings-form"
              style={{ marginTop: '1.25rem' }}
              onSubmit={(event) => {
                void handleRemovePin(event);
              }}
            >
              <h4 className="settings-card__title">Remove PIN</h4>
              <p className="settings-muted">
                Removing the PIN makes your portfolio immediately accessible to
                anyone who can open WorthLog on this network.
              </p>
              <div className="settings-field">
                <label htmlFor={removePinId}>Current PIN</label>
                <input
                  id={removePinId}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  autoComplete="current-password"
                  value={removeCurrentPin}
                  onChange={(event) => {
                    setRemoveCurrentPin(digitsOnly(event.target.value));
                  }}
                />
              </div>
              {removeError ? (
                <p className="settings-error" role="alert">
                  {removeError}
                </p>
              ) : null}
              <div className="settings-form-actions">
                <button
                  type="button"
                  className="settings-button settings-button--ghost"
                  disabled={removeBusy}
                  onClick={() => {
                    setRemoveOpen(false);
                    setRemoveCurrentPin('');
                    setRemoveError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="settings-button settings-button--danger"
                  disabled={removeBusy}
                >
                  {removeBusy ? 'Removing…' : 'Remove PIN'}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      )}
    </section>
  );
}
