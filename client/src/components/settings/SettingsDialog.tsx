import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import {
  ApiError,
  createCategory,
  deleteCategory,
  exportBackup,
  fetchCategories,
  importBackup,
  patchSettings,
  reorderCategories,
  updateCategory,
} from '../../api/client';
import type {
  AppSettings,
  BackupExport,
  Category,
  DashboardData,
  DashboardRange,
} from '../../api/types';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  buildBackupFilename,
  downloadBackupJson,
  isBackupExport,
} from '../../lib/backup-file';
import {
  CATEGORY_ICON_OPTIONS,
  getCategoryIcon,
} from '../../lib/icons';
import { ConfirmDialog } from '../ConfirmDialog';
import './SettingsDialog.css';

type SettingsTab = 'categories' | 'general' | 'backup';

interface SettingsDialogProps {
  open: boolean;
  settings: AppSettings;
  dashboard: DashboardData | null;
  restoreFocusTo?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onToast: (tone: 'success' | 'error', message: string) => void;
  onDataChanged: () => void;
}

interface CategoryDraft {
  name: string;
  color: string;
  icon: string;
}

const DEFAULT_DRAFT: CategoryDraft = {
  name: '',
  color: '#2563EB',
  icon: 'Circle',
};

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
];

function categoryHasHistory(
  dashboard: DashboardData | null,
  categoryId: string,
): boolean {
  if (!dashboard) {
    return false;
  }

  return (
    dashboard.historyRows.some((row) =>
      row.values.some((value) => value.categoryId === categoryId),
    ) ||
    dashboard.categoryTimeSeries.some(
      (series) => series.categoryId === categoryId,
    )
  );
}

export function SettingsDialog({
  open,
  settings,
  dashboard,
  restoreFocusTo,
  onClose,
  onToast,
  onDataChanged,
}: SettingsDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const [tab, setTab] = useState<SettingsTab>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [draft, setDraft] = useState<CategoryDraft>(DEFAULT_DRAFT);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [savingCategory, setSavingCategory] = useState(false);
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null);

  const [currency, setCurrency] = useState(settings.currency);
  const [defaultRange, setDefaultRange] = useState(settings.defaultRange);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [generalSuccess, setGeneralSuccess] = useState<string | null>(null);

  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<BackupExport | null>(null);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);

  useFocusTrap({
    open: open && !importConfirmOpen,
    containerRef: panelRef,
    restoreFocusTo,
    onEscape: onClose,
    escapeEnabled: !savingCategory && !savingGeneral && !backupBusy,
  });

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    setCategoriesError(null);
    try {
      const items = await fetchCategories(true);
      setCategories(items);
    } catch (error) {
      setCategoriesError(
        error instanceof Error ? error.message : 'Failed to load categories',
      );
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setTab('categories');
      setGeneralError(null);
      setGeneralSuccess(null);
      setBackupError(null);
      setBackupSuccess(null);
      setEditorOpen(false);
      setEditingCategory(null);
      setDraft(DEFAULT_DRAFT);
      setDraftErrors({});
      setArchivedOpen(false);
      void loadCategories();
    }

    if (open) {
      setCurrency(settings.currency);
      setDefaultRange(settings.defaultRange);
    }

    wasOpenRef.current = open;
  }, [open, settings.currency, settings.defaultRange, loadCategories]);

  const activeCategories = categories.filter(
    (category) => category.archivedAt === null,
  );
  const archivedCategories = categories.filter(
    (category) => category.archivedAt !== null,
  );

  const openCreateEditor = () => {
    setEditingCategory(null);
    setDraft(DEFAULT_DRAFT);
    setDraftErrors({});
    setEditorOpen(true);
  };

  const openEditEditor = (category: Category) => {
    setEditingCategory(category);
    setDraft({
      name: category.name,
      color: category.color,
      icon: category.icon,
    });
    setDraftErrors({});
    setEditorOpen(true);
  };

  const validateDraft = (): boolean => {
    const errors: Record<string, string> = {};
    const name = draft.name.trim();
    if (name.length === 0) {
      errors['name'] = 'Name is required';
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(draft.color)) {
      errors['color'] = 'Use a six-digit hex color like #2563EB';
    }
    if (draft.icon.trim().length === 0) {
      errors['icon'] = 'Choose an icon';
    }

    const normalizedName = name.toLocaleLowerCase();
    const duplicate = categories.some(
      (category) =>
        category.id !== editingCategory?.id &&
        category.name.toLocaleLowerCase() === normalizedName,
    );
    if (name && duplicate) {
      errors['name'] = 'A category with this name already exists';
    }

    setDraftErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveCategory = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingCategory || !validateDraft()) {
      return;
    }

    setSavingCategory(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: draft.name.trim(),
          color: draft.color,
          icon: draft.icon,
        });
        onToast('success', `Updated ${draft.name.trim()}`);
      } else {
        await createCategory({
          name: draft.name.trim(),
          color: draft.color,
          icon: draft.icon,
        });
        onToast('success', `Added ${draft.name.trim()}`);
      }
      setEditorOpen(false);
      setEditingCategory(null);
      await loadCategories();
      onDataChanged();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not save category';
      setDraftErrors({ form: message });
    } finally {
      setSavingCategory(false);
    }
  };

  const moveCategory = async (categoryId: string, direction: -1 | 1) => {
    const index = activeCategories.findIndex((item) => item.id === categoryId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= activeCategories.length) {
      return;
    }

    const nextActive = [...activeCategories];
    const [moved] = nextActive.splice(index, 1);
    if (!moved) {
      return;
    }
    nextActive.splice(target, 0, moved);

    setBusyCategoryId(categoryId);
    try {
      await reorderCategories([
        ...nextActive.map((item) => item.id),
        ...archivedCategories.map((item) => item.id),
      ]);
      await loadCategories();
      onDataChanged();
      onToast('success', 'Category order updated');
    } catch (error) {
      onToast(
        'error',
        error instanceof Error ? error.message : 'Could not reorder categories',
      );
    } finally {
      setBusyCategoryId(null);
    }
  };

  const setArchived = async (category: Category, archived: boolean) => {
    setBusyCategoryId(category.id);
    try {
      await updateCategory(category.id, { archived });
      await loadCategories();
      onDataChanged();
      onToast(
        'success',
        archived
          ? `Archived ${category.name}`
          : `Restored ${category.name}`,
      );
      if (archived) {
        setArchivedOpen(true);
      }
    } catch (error) {
      onToast(
        'error',
        error instanceof Error ? error.message : 'Could not update category',
      );
    } finally {
      setBusyCategoryId(null);
    }
  };

  const removeCategory = async (category: Category) => {
    if (categoryHasHistory(dashboard, category.id)) {
      onToast(
        'error',
        `${category.name} has snapshot history and can only be archived, not permanently deleted.`,
      );
      return;
    }

    setBusyCategoryId(category.id);
    try {
      await deleteCategory(category.id);
      await loadCategories();
      onDataChanged();
      onToast('success', `Deleted ${category.name}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CATEGORY_IN_USE') {
        onToast(
          'error',
          `${category.name} has snapshot history and can only be archived, not permanently deleted.`,
        );
      } else {
        onToast(
          'error',
          error instanceof Error ? error.message : 'Could not delete category',
        );
      }
    } finally {
      setBusyCategoryId(null);
    }
  };

  const saveGeneral = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGeneralError(null);
    setGeneralSuccess(null);

    const normalized = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
      setGeneralError('Currency must be a 3-letter code such as EUR');
      return;
    }

    setSavingGeneral(true);
    try {
      const updated = await patchSettings({
        currency: normalized,
        defaultRange,
      });
      setCurrency(updated.currency);
      setDefaultRange(updated.defaultRange);
      setGeneralSuccess('General settings saved');
      onToast('success', 'General settings saved');
      onDataChanged();
    } catch (error) {
      setGeneralError(
        error instanceof Error ? error.message : 'Could not save settings',
      );
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleExport = async () => {
    setBackupBusy(true);
    setBackupError(null);
    setBackupSuccess(null);
    try {
      const backup = await exportBackup();
      const filename = buildBackupFilename();
      downloadBackupJson(backup, filename);
      setBackupSuccess(`Downloaded ${filename}`);
      onToast('success', `Exported ${filename}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not export backup';
      setBackupError(message);
      onToast('error', message);
    } finally {
      setBackupBusy(false);
    }
  };

  const handleFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setBackupError(null);
    setBackupSuccess(null);

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.json')) {
      setBackupError('Choose a .json backup file');
      return;
    }

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!isBackupExport(parsed)) {
        setBackupError(
          'This file is not a valid Worthlog backup (expected version 1).',
        );
        return;
      }
      setPendingImport(parsed);
      setImportConfirmOpen(true);
    } catch {
      setBackupError('Could not read this file as JSON');
    }
  };

  const confirmImport = async () => {
    if (!pendingImport || backupBusy) {
      return;
    }

    setBackupBusy(true);
    setBackupError(null);
    try {
      const result = await importBackup(pendingImport);
      setImportConfirmOpen(false);
      setPendingImport(null);
      setBackupSuccess(
        `Import complete. Server backup saved at ${result.backupPath}. Restored ${String(result.counts.categories)} categories and ${String(result.counts.snapshots)} snapshots.`,
      );
      onToast('success', 'Backup imported successfully');
      await loadCategories();
      onDataChanged();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not import backup';
      setBackupError(message);
      onToast('error', message);
    } finally {
      setBackupBusy(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="settings-dialog" role="presentation">
        <button
          type="button"
          className="settings-dialog__backdrop"
          aria-label="Dismiss settings"
          onClick={onClose}
        />
        <div
          ref={panelRef}
          className="settings-dialog__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
        >
          <header className="settings-dialog__header">
            <div>
              <h2 id={titleId} className="settings-dialog__title">
                Settings
              </h2>
              <p id={descriptionId} className="settings-dialog__subtitle">
                Manage categories, preferences, and backups
              </p>
            </div>
            <button
              type="button"
              className="settings-dialog__close"
              onClick={onClose}
            >
              Close
            </button>
          </header>

          <div className="settings-dialog__tabs" role="tablist" aria-label="Settings sections">
            {(
              [
                ['categories', 'Categories'],
                ['general', 'General'],
                ['backup', 'Backup and restore'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                className={
                  tab === value
                    ? 'settings-dialog__tab settings-dialog__tab--active'
                    : 'settings-dialog__tab'
                }
                onClick={() => {
                  setTab(value);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="settings-dialog__body">
            {tab === 'categories' ? (
              <section className="settings-section" aria-label="Categories">
                <p className="settings-section__intro">
                  Categories group your investment totals. Snapshot history is kept
                  when a category is archived. Only unused categories can be
                  permanently deleted.
                </p>

                <div className="settings-toolbar">
                  <h3 className="settings-card__title">Active categories</h3>
                  <button
                    type="button"
                    className="settings-button settings-button--primary"
                    onClick={openCreateEditor}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add category
                  </button>
                </div>

                {loadingCategories ? (
                  <p className="settings-muted">Loading categories…</p>
                ) : null}
                {categoriesError ? (
                  <p className="settings-error" role="alert">
                    {categoriesError}
                  </p>
                ) : null}

                <div className="settings-list">
                  {activeCategories.map((category, index) => {
                    const Icon = getCategoryIcon(category.icon);
                    const hasHistory = categoryHasHistory(dashboard, category.id);
                    const busy = busyCategoryId === category.id;

                    return (
                      <article key={category.id} className="settings-category">
                        <span
                          className="settings-category__icon"
                          style={{
                            color: category.color,
                            background: `${category.color}1f`,
                          }}
                          aria-hidden="true"
                        >
                          <Icon size={18} strokeWidth={1.8} />
                        </span>
                        <div>
                          <p className="settings-category__name">{category.name}</p>
                          <p className="settings-category__meta">
                            {category.color} · {category.icon}
                            {hasHistory ? ' · Has snapshot history' : ''}
                          </p>
                        </div>
                        <div className="settings-category__actions">
                          <button
                            type="button"
                            className="settings-button settings-button--ghost"
                            aria-label={`Move ${category.name} up`}
                            disabled={busy || index === 0}
                            onClick={() => {
                              void moveCategory(category.id, -1);
                            }}
                          >
                            <ChevronUp size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="settings-button settings-button--ghost"
                            aria-label={`Move ${category.name} down`}
                            disabled={
                              busy || index === activeCategories.length - 1
                            }
                            onClick={() => {
                              void moveCategory(category.id, 1);
                            }}
                          >
                            <ChevronDown size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="settings-button settings-button--ghost"
                            aria-label={`Edit ${category.name}`}
                            disabled={busy}
                            onClick={() => {
                              openEditEditor(category);
                            }}
                          >
                            <Pencil size={15} aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="settings-button settings-button--ghost"
                            aria-label={`Archive ${category.name}`}
                            disabled={busy}
                            onClick={() => {
                              void setArchived(category, true);
                            }}
                          >
                            <Archive size={15} aria-hidden="true" />
                            Archive
                          </button>
                          <button
                            type="button"
                            className="settings-button settings-button--danger"
                            aria-label={`Delete ${category.name}`}
                            disabled={busy}
                            title={
                              hasHistory
                                ? 'Categories with snapshot history can only be archived'
                                : 'Permanently delete this unused category'
                            }
                            onClick={() => {
                              void removeCategory(category);
                            }}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                            Delete
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {hasHistoryNotice(activeCategories, dashboard) ? (
                  <p className="settings-notice">
                    Categories with snapshot history keep that history when archived.
                    Permanent delete is only available for categories that were never
                    used in a snapshot.
                  </p>
                ) : null}

                <div className="settings-archived">
                  <button
                    type="button"
                    className="settings-archived__toggle"
                    aria-expanded={archivedOpen}
                    onClick={() => {
                      setArchivedOpen((value) => !value);
                    }}
                  >
                    <span>
                      Archived categories ({String(archivedCategories.length)})
                    </span>
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      style={{
                        transform: archivedOpen ? 'rotate(180deg)' : undefined,
                      }}
                    />
                  </button>
                  {archivedOpen ? (
                    <div className="settings-archived__body">
                      {archivedCategories.length === 0 ? (
                        <p className="settings-muted">No archived categories.</p>
                      ) : (
                        archivedCategories.map((category) => {
                          const Icon = getCategoryIcon(category.icon);
                          const busy = busyCategoryId === category.id;
                          return (
                            <article
                              key={category.id}
                              className="settings-category"
                            >
                              <span
                                className="settings-category__icon"
                                style={{
                                  color: category.color,
                                  background: `${category.color}1f`,
                                }}
                                aria-hidden="true"
                              >
                                <Icon size={18} strokeWidth={1.8} />
                              </span>
                              <div>
                                <p className="settings-category__name">
                                  {category.name}
                                </p>
                                <p className="settings-category__meta">
                                  Archived · history preserved
                                </p>
                              </div>
                              <div className="settings-category__actions">
                                <button
                                  type="button"
                                  className="settings-button settings-button--ghost"
                                  disabled={busy}
                                  onClick={() => {
                                    void setArchived(category, false);
                                  }}
                                >
                                  <ArchiveRestore size={15} aria-hidden="true" />
                                  Restore
                                </button>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>

                {editorOpen ? (
                  <form
                    className="settings-card settings-form"
                    onSubmit={(event) => {
                      void saveCategory(event);
                    }}
                  >
                    <h3 className="settings-card__title">
                      {editingCategory ? 'Edit category' : 'Add category'}
                    </h3>
                    <div className="settings-field">
                      <label htmlFor="category-name">Name</label>
                      <input
                        id="category-name"
                        value={draft.name}
                        onChange={(event) => {
                          setDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }));
                        }}
                        aria-invalid={Boolean(draftErrors['name'])}
                      />
                      {draftErrors['name'] ? (
                        <p className="settings-field-error">{draftErrors['name']}</p>
                      ) : null}
                    </div>
                    <div className="settings-field">
                      <label htmlFor="category-color">Color</label>
                      <input
                        id="category-color"
                        type="text"
                        value={draft.color}
                        onChange={(event) => {
                          setDraft((current) => ({
                            ...current,
                            color: event.target.value,
                          }));
                        }}
                        placeholder="#2563EB"
                        aria-invalid={Boolean(draftErrors['color'])}
                      />
                      {draftErrors['color'] ? (
                        <p className="settings-field-error">{draftErrors['color']}</p>
                      ) : null}
                    </div>
                    <fieldset className="settings-field">
                      <legend>Lucide icon</legend>
                      <div className="settings-icon-grid">
                        {CATEGORY_ICON_OPTIONS.map((iconName) => {
                          const Icon = getCategoryIcon(iconName);
                          const active = draft.icon === iconName;
                          return (
                            <button
                              key={iconName}
                              type="button"
                              className={
                                active
                                  ? 'settings-icon-option settings-icon-option--active'
                                  : 'settings-icon-option'
                              }
                              aria-label={iconName}
                              aria-pressed={active}
                              onClick={() => {
                                setDraft((current) => ({
                                  ...current,
                                  icon: iconName,
                                }));
                              }}
                            >
                              <Icon size={18} aria-hidden="true" />
                            </button>
                          );
                        })}
                      </div>
                      {draftErrors['icon'] ? (
                        <p className="settings-field-error">{draftErrors['icon']}</p>
                      ) : null}
                    </fieldset>
                    {draftErrors['form'] ? (
                      <p className="settings-error" role="alert">
                        {draftErrors['form']}
                      </p>
                    ) : null}
                    <div className="settings-form-actions">
                      <button
                        type="button"
                        className="settings-button settings-button--ghost"
                        onClick={() => {
                          setEditorOpen(false);
                        }}
                        disabled={savingCategory}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="settings-button settings-button--primary"
                        disabled={savingCategory}
                      >
                        {savingCategory ? 'Saving…' : 'Save category'}
                      </button>
                    </div>
                  </form>
                ) : null}
              </section>
            ) : null}

            {tab === 'general' ? (
              <section className="settings-section" aria-label="General">
                <p className="settings-section__intro">
                  Worthlog has no login and is intended for a trusted local network
                  or personal machine. Anyone who can reach the app can view and
                  change your data.
                </p>
                <form
                  className="settings-card settings-form"
                  onSubmit={(event) => {
                    void saveGeneral(event);
                  }}
                >
                  <div className="settings-field">
                    <label htmlFor="settings-currency">Currency</label>
                    <input
                      id="settings-currency"
                      value={currency}
                      onChange={(event) => {
                        setCurrency(event.target.value.toUpperCase());
                      }}
                      maxLength={3}
                      placeholder="EUR"
                    />
                    <p className="settings-hint">
                      Default is EUR. Use a 3-letter ISO currency code for display.
                    </p>
                  </div>
                  <div className="settings-field">
                    <label htmlFor="settings-range">Default dashboard range</label>
                    <select
                      id="settings-range"
                      value={defaultRange}
                      onChange={(event) => {
                        setDefaultRange(event.target.value as DashboardRange);
                      }}
                    >
                      {RANGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {generalError ? (
                    <p className="settings-error" role="alert">
                      {generalError}
                    </p>
                  ) : null}
                  {generalSuccess ? (
                    <p className="settings-success" role="status">
                      {generalSuccess}
                    </p>
                  ) : null}
                  <div className="settings-form-actions">
                    <button
                      type="submit"
                      className="settings-button settings-button--primary"
                      disabled={savingGeneral}
                    >
                      {savingGeneral ? 'Saving…' : 'Save general settings'}
                    </button>
                  </div>
                </form>
              </section>
            ) : null}

            {tab === 'backup' ? (
              <section className="settings-section" aria-label="Backup and restore">
                <p className="settings-section__intro">
                  Export a portable JSON backup, or restore from a previous export.
                  Before import, the server automatically creates a timestamped
                  SQLite database backup in your data directory.
                </p>

                <div className="settings-card">
                  <h3 className="settings-card__title">Export backup</h3>
                  <p className="settings-muted">
                    Downloads settings, categories, snapshots, and values as JSON.
                  </p>
                  <div className="settings-backup-actions">
                    <button
                      type="button"
                      className="settings-button settings-button--primary"
                      onClick={() => {
                        void handleExport();
                      }}
                      disabled={backupBusy}
                    >
                      Export backup
                    </button>
                  </div>
                </div>

                <div className="settings-card">
                  <h3 className="settings-card__title">Import backup</h3>
                  <p className="settings-muted">
                    Importing replaces all current Worthlog data. The server first
                    writes an automatic database backup, then restores the JSON
                    inside a transaction.
                  </p>
                  <div className="settings-backup-actions">
                    <button
                      type="button"
                      className="settings-button settings-button--ghost"
                      onClick={() => {
                        fileInputRef.current?.click();
                      }}
                      disabled={backupBusy}
                    >
                      Choose backup file…
                    </button>
                    <input
                      ref={fileInputRef}
                      className="settings-file-input"
                      type="file"
                      accept="application/json,.json"
                      onChange={(event) => {
                        void handleFileChosen(event);
                      }}
                    />
                  </div>
                </div>

                {backupError ? (
                  <p className="settings-error" role="alert">
                    {backupError}
                  </p>
                ) : null}
                {backupSuccess ? (
                  <p className="settings-success" role="status">
                    {backupSuccess}
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={importConfirmOpen}
        title="Replace all Worthlog data?"
        description="This import will replace categories, snapshots, values, and settings. Before applying the file, the server creates an automatic timestamped database backup in your data directory. This cannot be undone from the UI."
        confirmLabel="Import and replace"
        tone="danger"
        busy={backupBusy}
        onCancel={() => {
          if (!backupBusy) {
            setImportConfirmOpen(false);
            setPendingImport(null);
          }
        }}
        onConfirm={() => {
          void confirmImport();
        }}
      />
    </>
  );
}

function hasHistoryNotice(
  activeCategories: Category[],
  dashboard: DashboardData | null,
): boolean {
  return activeCategories.some((category) =>
    categoryHasHistory(dashboard, category.id),
  );
}
