import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, deleteSnapshot, fetchCategories } from './api/client';
import type { DashboardRange } from './api/types';
import { AllocationChart } from './components/AllocationChart';
import { CategoryCards } from './components/CategoryCards';
import { ConfirmDialog } from './components/ConfirmDialog';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import { Header } from './components/Header';
import { HistoryTable } from './components/HistoryTable';
import {
  SettingsDialog,
  type SettingsTab,
} from './components/settings/SettingsDialog';
import { DashboardSkeleton } from './components/Skeleton';
import {
  SnapshotModal,
  type SnapshotModalMode,
} from './components/SnapshotModal';
import { PrivacyValue } from './components/PrivacyValue';
import { SummaryCards } from './components/SummaryCards';
import { Toast, type ToastMessage } from './components/Toast';
import { TotalValueChart } from './components/TotalValueChart';
import { useAuth } from './auth/AuthContext';
import { useDashboard } from './hooks/useDashboard';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import { formatMoney, formatSnapshotDate } from './lib/format';
import { createClientId } from './lib/id';
import { usePrivacyModeContext } from './privacy/PrivacyModeContext';
import './Dashboard.css';

interface DeleteTarget {
  date: string;
  totalValueCents: number;
}

export function Dashboard() {
  const { theme, toggleTheme } = useTheme();
  const { hidden: privacyHidden, toggle: togglePrivacy } =
    usePrivacyModeContext();
  const { pinEnabled, lock } = useAuth();
  const {
    settings,
    loading: settingsLoading,
    error: settingsError,
    reload: reloadSettings,
  } = useSettings();
  const [range, setRange] = useState<DashboardRange | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('categories');
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotMode, setSnapshotMode] = useState<SnapshotModalMode>('add');
  const [editDate, setEditDate] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [locking, setLocking] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [categoriesRevision, setCategoriesRevision] = useState(0);
  const [activeCategoryCount, setActiveCategoryCount] = useState<number | null>(
    null,
  );
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const handleLock = async () => {
    if (locking) {
      return;
    }
    setLocking(true);
    try {
      setSettingsDialogOpen(false);
      setSnapshotOpen(false);
      await lock();
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'Could not lock WorthLog';
      setToast({
        id: createClientId(),
        tone: 'error',
        message,
      });
    } finally {
      setLocking(false);
    }
  };

  useEffect(() => {
    if (settings && range === null) {
      setRange(settings.defaultRange);
    }
  }, [settings, range]);

  const {
    data,
    loading: dashboardLoading,
    refreshing,
    error: dashboardError,
    reload,
  } = useDashboard(range);

  const currency = settings?.currency ?? 'EUR';
  const fatalError = settingsError ?? (!data ? dashboardError : null);
  const recoverableError = data ? dashboardError : null;
  const isEmptyPortfolio = Boolean(data && !data.hasSnapshots);
  const hasNoCategories = activeCategoryCount === 0;

  useEffect(() => {
    let active = true;
    void fetchCategories(false)
      .then((categories) => {
        if (active) {
          setActiveCategoryCount(categories.length);
        }
      })
      .catch(() => {
        if (active) {
          setActiveCategoryCount(null);
        }
      });
    return () => {
      active = false;
    };
  }, [categoriesRevision, data]);

  const refreshAppData = () => {
    reload();
    reloadSettings();
    setCategoriesRevision((value) => value + 1);
  };

  const openCategorySettings = (trigger?: HTMLElement | null) => {
    restoreFocusRef.current = trigger ?? null;
    setSnapshotOpen(false);
    setEditDate(null);
    setSettingsTab('categories');
    setSettingsDialogOpen(true);
  };

  const openAddSnapshot = (trigger?: HTMLElement) => {
    restoreFocusRef.current = trigger ?? null;
    setSnapshotMode('add');
    setEditDate(null);
    setSnapshotOpen(true);
  };

  const openEditSnapshot = (date: string, trigger: HTMLElement) => {
    restoreFocusRef.current = trigger;
    setSnapshotMode('edit');
    setEditDate(date);
    setSnapshotOpen(true);
  };

  const openDeleteSnapshot = (
    date: string,
    totalValueCents: number,
    trigger: HTMLElement,
  ) => {
    restoreFocusRef.current = trigger;
    setDeleteTarget({ date, totalValueCents });
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) {
      return;
    }

    setDeleting(true);
    try {
      await deleteSnapshot(deleteTarget.date);
      setToast({
        id: createClientId(),
        tone: 'success',
        message: `Snapshot for ${formatSnapshotDate(deleteTarget.date)} deleted`,
      });
      setDeleteTarget(null);
      reload();
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'Could not delete snapshot';
      setToast({
        id: createClientId(),
        tone: 'error',
        message,
      });
    } finally {
      setDeleting(false);
    }
  };

  let mainContent: ReactNode;

  if (settingsLoading || range === null || (dashboardLoading && !data)) {
    mainContent = <DashboardSkeleton />;
  } else if (fatalError) {
    mainContent = (
      <ErrorState
        title="Could not load dashboard"
        message={fatalError}
        onRetry={reload}
      />
    );
  } else if (hasNoCategories) {
    mainContent = (
      <EmptyState
        variant="no-categories"
        onAddSnapshot={() => {
          openAddSnapshot();
        }}
        onOpenSettings={() => {
          openCategorySettings();
        }}
      />
    );
  } else if (!data || isEmptyPortfolio) {
    mainContent = (
      <EmptyState
        onAddSnapshot={() => {
          openAddSnapshot();
        }}
        onOpenSettings={() => {
          openCategorySettings();
        }}
      />
    );
  } else {
    mainContent = (
      <div className="dashboard__content">
        {recoverableError ? (
          <ErrorState
            title="Could not refresh dashboard"
            message={recoverableError}
            onRetry={reload}
          />
        ) : null}

        <SummaryCards data={data} currency={currency} />

        <div className="dashboard__charts">
          <TotalValueChart
            data={data}
            currency={currency}
            range={range}
            onRangeChange={setRange}
            refreshing={refreshing}
          />
          <AllocationChart data={data} currency={currency} />
        </div>

        <CategoryCards data={data} currency={currency} />
        <HistoryTable
          data={data}
          currency={currency}
          onEdit={openEditSnapshot}
          onDelete={openDeleteSnapshot}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <div className="dashboard">
        <Header
          theme={theme}
          privacyHidden={privacyHidden}
          showLockButton={pinEnabled}
          onToggleTheme={toggleTheme}
          onTogglePrivacy={togglePrivacy}
          onLock={() => {
            void handleLock();
          }}
          onAddSnapshot={() => {
            const active = document.activeElement;
            openAddSnapshot(
              active instanceof HTMLElement ? active : undefined,
            );
          }}
          onOpenSettings={() => {
            const active = document.activeElement;
            openCategorySettings(
              active instanceof HTMLElement ? active : null,
            );
          }}
        />

        <main className="dashboard__main">{mainContent}</main>
      </div>

      <SnapshotModal
        open={snapshotOpen}
        mode={snapshotMode}
        editDate={editDate}
        currency={currency}
        dashboard={data}
        categoriesRevision={categoriesRevision}
        restoreFocusTo={restoreFocusRef}
        onClose={() => {
          setSnapshotOpen(false);
          setEditDate(null);
        }}
        onSaved={(message) => {
          setToast({
            id: createClientId(),
            tone: 'success',
            message,
          });
          reload();
        }}
        onOpenCategorySettings={() => {
          openCategorySettings(restoreFocusRef.current);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete snapshot?"
        description={
          deleteTarget ? (
            <>
              Delete the snapshot for{' '}
              {formatSnapshotDate(deleteTarget.date)} with a total of{' '}
              <PrivacyValue>
                {formatMoney(deleteTarget.totalValueCents, currency)}
              </PrivacyValue>
              ? This cannot be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete snapshot"
        tone="danger"
        busy={deleting}
        restoreFocusTo={restoreFocusRef}
        onCancel={() => {
          if (!deleting) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => {
          void handleDelete();
        }}
      />

      {settings ? (
        <SettingsDialog
          open={settingsDialogOpen}
          settings={settings}
          initialTab={settingsTab}
          restoreFocusTo={restoreFocusRef}
          onClose={() => {
            setSettingsDialogOpen(false);
          }}
          onToast={(tone, message) => {
            setToast({
              id: createClientId(),
              tone,
              message,
            });
          }}
          onDataChanged={refreshAppData}
          onLockNow={() => {
            void handleLock();
          }}
        />
      ) : null}

      <Toast
        toast={toast}
        onDismiss={() => {
          setToast(null);
        }}
      />
    </div>
  );
}
