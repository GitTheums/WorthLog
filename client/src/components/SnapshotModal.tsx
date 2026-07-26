import { format } from 'date-fns';
import { Info } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import {
  ApiError,
  fetchCategories,
  fetchSnapshot,
  putSnapshot,
} from '../api/client';
import type { Category, DashboardData } from '../api/types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { formatMoney, formatSnapshotDate } from '../lib/format';
import { formatCentsInput, parseMoneyInput, sumCents } from '../lib/money';
import { getCategoryIcon } from '../lib/icons';
import { ConfirmDialog } from './ConfirmDialog';
import { PrivacyValue } from './PrivacyValue';
import './SnapshotModal.css';

export type SnapshotModalMode = 'add' | 'edit';

interface SnapshotModalProps {
  open: boolean;
  mode: SnapshotModalMode;
  editDate?: string | null;
  currency: string;
  dashboard: DashboardData | null;
  /** Bump when categories change so an open form reloads the field list. */
  categoriesRevision?: number;
  restoreFocusTo?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSaved: (message: string) => void;
  onOpenCategorySettings?: () => void;
}

type FieldErrors = Record<string, string>;

function todayIsoDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function buildInitialValues(
  categories: Category[],
  mode: SnapshotModalMode,
  dashboard: DashboardData | null,
  snapshotValues?: Map<string, number>,
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const category of categories) {
    if (snapshotValues?.has(category.id)) {
      values[category.id] = formatCentsInput(
        snapshotValues.get(category.id) ?? 0,
      );
      continue;
    }

    if (mode === 'add' && dashboard && dashboard.latestCategoryValues.length > 0) {
      const latest = dashboard.latestCategoryValues.find(
        (item) => item.categoryId === category.id,
      );
      values[category.id] =
        latest === undefined ? '' : formatCentsInput(latest.amountCents);
      continue;
    }

    values[category.id] = '';
  }

  return values;
}

export function SnapshotModal({
  open,
  mode,
  editDate = null,
  currency,
  dashboard,
  categoriesRevision = 0,
  restoreFocusTo,
  onClose,
  onSaved,
  onOpenCategorySettings,
}: SnapshotModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const dateId = useId();
  const noteId = useId();
  const totalId = useId();

  const [categories, setCategories] = useState<Category[]>([]);
  const [date, setDate] = useState(todayIsoDate());
  const [note, setNote] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingSnapshot, setExistingSnapshot] = useState(false);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isEdit = mode === 'edit';

  useBodyScrollLock(open);

  useFocusTrap({
    open,
    containerRef: panelRef,
    restoreFocusTo,
    onEscape: () => {
      if (!saving && !replaceConfirmOpen) {
        onClose();
      }
    },
    escapeEnabled: !saving && !replaceConfirmOpen,
  });

  const loadModalData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setFormError(null);
    setFieldErrors({});
    setReplaceConfirmOpen(false);

    try {
      const activeCategories = await fetchCategories(false);
      setCategories(activeCategories);

      if (isEdit && editDate) {
        const snapshot = await fetchSnapshot(editDate);
        const snapshotValues = new Map(
          snapshot.values.map((value) => [value.categoryId, value.amountCents]),
        );
        setDate(snapshot.date);
        setNote(snapshot.note ?? '');
        setValues(
          buildInitialValues(
            activeCategories,
            mode,
            dashboard,
            snapshotValues,
          ),
        );
        setExistingSnapshot(true);
      } else {
        const initialDate = todayIsoDate();
        setDate(initialDate);
        setNote('');
        setValues(buildInitialValues(activeCategories, mode, dashboard));
        setExistingSnapshot(false);

        try {
          await fetchSnapshot(initialDate);
          setExistingSnapshot(true);
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 404)) {
            throw error;
          }
        }
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to open snapshot editor';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [dashboard, editDate, isEdit, mode]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadModalData();
  }, [open, loadModalData, categoriesRevision]);

  useEffect(() => {
    if (!open || isEdit || loading || !date) {
      return;
    }

    let active = true;

    void fetchSnapshot(date)
      .then(() => {
        if (active) {
          setExistingSnapshot(true);
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setExistingSnapshot(false);
          return;
        }
        setFormError(
          error instanceof Error ? error.message : 'Could not check this date',
        );
      });

    return () => {
      active = false;
    };
  }, [date, open, isEdit, loading]);

  const parsedValues = useMemo(() => {
    const centsByCategory = new Map<string, number>();
    let allValid = categories.length > 0;

    for (const category of categories) {
      const raw = values[category.id] ?? '';
      const parsed = parseMoneyInput(raw);
      if (!parsed.ok) {
        allValid = false;
        continue;
      }
      centsByCategory.set(category.id, parsed.cents);
    }

    return { centsByCategory, allValid };
  }, [categories, values]);

  const liveTotalCents = sumCents([...parsedValues.centsByCategory.values()]);

  const validate = (): {
    ok: boolean;
    centsByCategory: Map<string, number>;
    errors: FieldErrors;
  } => {
    const errors: FieldErrors = {};
    const centsByCategory = new Map<string, number>();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors['date'] = 'Choose a valid date';
    }

    for (const category of categories) {
      const parsed = parseMoneyInput(values[category.id] ?? '');
      if (!parsed.ok) {
        errors[category.id] = parsed.error;
        continue;
      }
      centsByCategory.set(category.id, parsed.cents);
    }

    if (categories.length === 0) {
      errors['form'] = 'There are no active categories to save';
    }

    return {
      ok: Object.keys(errors).length === 0,
      centsByCategory,
      errors,
    };
  };

  const persist = async (centsByCategory: Map<string, number>) => {
    setSaving(true);
    setFormError(null);

    try {
      await putSnapshot(date, {
        note: note.trim().length > 0 ? note.trim() : null,
        values: categories.map((category) => ({
          categoryId: category.id,
          amountCents: centsByCategory.get(category.id) ?? 0,
        })),
      });

      onSaved(
        isEdit
          ? `Snapshot for ${formatSnapshotDate(date)} updated`
          : existingSnapshot
            ? `Snapshot for ${formatSnapshotDate(date)} replaced`
            : `Snapshot for ${formatSnapshotDate(date)} saved`,
      );
      onClose();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not save snapshot';
      setFormError(message);
    } finally {
      setSaving(false);
      setReplaceConfirmOpen(false);
    }
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || loading) {
      return;
    }

    const result = validate();
    setFieldErrors(result.errors);

    if (!result.ok) {
      setFormError('Please fix the highlighted fields');
      return;
    }

    if (!isEdit && existingSnapshot) {
      setReplaceConfirmOpen(true);
      return;
    }

    void persist(result.centsByCategory);
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="snapshot-modal" role="presentation">
        <button
          type="button"
          className="snapshot-modal__backdrop"
          aria-label="Dismiss snapshot dialog"
          disabled={saving}
          onClick={() => {
            if (!saving) {
              onClose();
            }
          }}
        />

        <div
          ref={panelRef}
          className="snapshot-modal__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
        >
          <header className="snapshot-modal__header">
            <div>
              <h2 id={titleId} className="snapshot-modal__title">
                {isEdit ? 'Edit snapshot' : 'Add snapshot'}
              </h2>
              <p id={descriptionId} className="snapshot-modal__subtitle">
                {isEdit && editDate
                  ? `Editing values for ${formatSnapshotDate(editDate)}`
                  : 'Record the total value of each active category for a date'}
              </p>
            </div>
            <button
              type="button"
              className="snapshot-modal__close"
              onClick={onClose}
              disabled={saving}
              aria-label="Close snapshot dialog"
            >
              Close
            </button>
          </header>

          {loading ? (
            <p className="snapshot-modal__status">Loading snapshot editor…</p>
          ) : null}

          {loadError ? (
            <p className="snapshot-modal__error" role="alert">
              {loadError}
            </p>
          ) : null}

          {!loading && !loadError && categories.length === 0 ? (
            <div className="snapshot-modal__empty-categories">
              <p className="snapshot-modal__empty-categories-text">
                No active categories yet. Add a category in Settings before
                creating a snapshot.
              </p>
              <div className="snapshot-modal__actions">
                <button
                  type="button"
                  className="snapshot-modal__button snapshot-modal__button--ghost"
                  onClick={onClose}
                >
                  Cancel
                </button>
                {onOpenCategorySettings ? (
                  <button
                    type="button"
                    className="snapshot-modal__button snapshot-modal__button--primary"
                    onClick={onOpenCategorySettings}
                  >
                    Open category settings
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {!loading && !loadError && categories.length > 0 ? (
            <form className="snapshot-modal__form" onSubmit={handleSubmit} noValidate>
              <div className="snapshot-modal__field">
                <label htmlFor={dateId}>Snapshot date</label>
                <input
                  id={dateId}
                  type="date"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                  }}
                  disabled={isEdit || saving}
                  aria-invalid={Boolean(fieldErrors['date'])}
                  aria-describedby={
                    fieldErrors['date'] ? `${dateId}-error` : undefined
                  }
                  required
                />
                {fieldErrors['date'] ? (
                  <p id={`${dateId}-error`} className="snapshot-modal__field-error">
                    {fieldErrors['date']}
                  </p>
                ) : null}
                {!isEdit && existingSnapshot ? (
                  <p className="snapshot-modal__warning" role="status">
                    A snapshot already exists for this date. Saving will replace
                    its complete category values.
                  </p>
                ) : null}
              </div>

              {!isEdit &&
              categories.length === 1 &&
              !(dashboard?.hasSnapshots ?? false) ? (
                <div className="snapshot-modal__callout" role="note">
                  <Info
                    className="snapshot-modal__callout-icon"
                    size={16}
                    aria-hidden="true"
                  />
                  <p>
                    Starting simple? You can add more investment categories later
                    in Settings.
                  </p>
                </div>
              ) : null}

              <fieldset className="snapshot-modal__categories" disabled={saving}>
                <legend>Category values</legend>
                <p id="category-values-hint" className="snapshot-modal__hint">
                  Leave empty if you do not own anything in this category.
                </p>
                <div className="snapshot-modal__category-list">
                  {categories.map((category) => {
                    const inputId = `category-${category.id}`;
                    const Icon = getCategoryIcon(category.icon);
                    const error = fieldErrors[category.id];
                    const describedBy = [
                      'category-values-hint',
                      error ? `${inputId}-error` : null,
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <div key={category.id} className="snapshot-modal__category">
                        <label htmlFor={inputId} className="snapshot-modal__category-label">
                          <span
                            className="snapshot-modal__category-icon"
                            style={{
                              color: category.color,
                              background: `${category.color}1f`,
                            }}
                            aria-hidden="true"
                          >
                            <Icon size={16} strokeWidth={1.8} />
                          </span>
                          <span>{category.name}</span>
                        </label>
                        <div className="snapshot-modal__money">
                          <span className="snapshot-modal__currency" aria-hidden="true">
                            {currency}
                          </span>
                          <input
                            id={inputId}
                            inputMode="decimal"
                            autoComplete="off"
                            value={values[category.id] ?? ''}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              const categoryId = category.id;
                              setValues((current) => ({
                                ...current,
                                [categoryId]: nextValue,
                              }));
                              setFieldErrors((current) => {
                                if (!(categoryId in current)) {
                                  return current;
                                }
                                return Object.fromEntries(
                                  Object.entries(current).filter(
                                    ([key]) => key !== categoryId,
                                  ),
                                );
                              });
                            }}
                            aria-invalid={Boolean(error)}
                            aria-describedby={describedBy}
                            placeholder="0.00"
                          />
                        </div>
                        {error ? (
                          <p
                            id={`${inputId}-error`}
                            className="snapshot-modal__field-error"
                          >
                            {error}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              <div className="snapshot-modal__field">
                <label htmlFor={noteId}>Note (optional)</label>
                <textarea
                  id={noteId}
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                  }}
                  rows={3}
                  maxLength={2000}
                  disabled={saving}
                />
              </div>

              <div className="snapshot-modal__total" aria-live="polite">
                <span id={totalId}>Live total</span>
                <strong aria-labelledby={totalId}>
                  {parsedValues.centsByCategory.size === categories.length &&
                  categories.length > 0 ? (
                    <PrivacyValue>
                      {formatMoney(liveTotalCents, currency)}
                    </PrivacyValue>
                  ) : (
                    '—'
                  )}
                </strong>
              </div>

              {formError ? (
                <p className="snapshot-modal__error" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="snapshot-modal__actions">
                <button
                  type="button"
                  className="snapshot-modal__button snapshot-modal__button--ghost"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="snapshot-modal__button snapshot-modal__button--primary"
                  disabled={saving || categories.length === 0}
                >
                  {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save snapshot'}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={replaceConfirmOpen}
        title="Replace existing snapshot?"
        description={`A snapshot for ${formatSnapshotDate(date)} already exists. Saving will replace its complete category value set.`}
        confirmLabel="Replace snapshot"
        tone="danger"
        busy={saving}
        onCancel={() => {
          setReplaceConfirmOpen(false);
        }}
        onConfirm={() => {
          const result = validate();
          setFieldErrors(result.errors);
          if (!result.ok) {
            setReplaceConfirmOpen(false);
            setFormError('Please fix the highlighted fields');
            return;
          }
          void persist(result.centsByCategory);
        }}
      />
    </>
  );
}
