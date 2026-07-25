import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, deleteSnapshot } from './api/client';
import type { DashboardRange } from './api/types';
import { AllocationChart } from './components/AllocationChart';
import { CategoryCards } from './components/CategoryCards';
import { ConfirmDialog } from './components/ConfirmDialog';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import { Header } from './components/Header';
import { HistoryTable } from './components/HistoryTable';
import { SettingsDialog } from './components/settings/SettingsDialog';
import { DashboardSkeleton } from './components/Skeleton';
import {
  SnapshotModal,
  type SnapshotModalMode,
} from './components/SnapshotModal';
import { SummaryCards } from './components/SummaryCards';
import { Toast, type ToastMessage } from './components/Toast';
import { TotalValueChart } from './components/TotalValueChart';
import { useDashboard } from './hooks/useDashboard';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import { formatMoney, formatSnapshotDate } from './lib/format';
import './Dashboard.css';

interface DeleteTarget {
  date: string;
  totalValueCents: number;
}

export function Dashboard() {
  const { theme, toggleTheme } = useTheme();
  const {
    settings,
    loading: settingsLoading,
    error: settingsError,
    reload: reloadSettings,
  } = useSettings();
  const [range, setRange] = useState<DashboardRange | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotMode, setSnapshotMode] = useState<SnapshotModalMode>('add');
  const [editDate, setEditDate] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [categoriesRevision, setCategoriesRevision] = useState(0);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (settings && range === null) {
      setRange(settings.defaultRange);
    }
  }, [settings, range]);

  const {
    data,
    loading: dashboardLoading,
    error: dashboardError,
    reload,
  } = useDashboard(range);

  const currency = settings?.currency ?? 'EUR';
  const showSkeleton =
    settingsLoading || range === null || (dashboardLoading && !data);
  const error = settingsError ?? dashboardError;
  const isEmpty = Boolean(data && data.historyRows.length === 0);

  const refreshAppData = () => {
    reload();
    reloadSettings();
    setCategoriesRevision((value) => value + 1);
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
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
        tone: 'error',
        message,
      });
    } finally {
      setDeleting(false);
    }
  };

  let mainContent: ReactNode;

  if (showSkeleton) {
    mainContent = <DashboardSkeleton />;
  } else if (error) {
    mainContent = (
      <ErrorState
        title="Could not load dashboard"
        message={error}
        onRetry={reload}
      />
    );
  } else if (isEmpty || !data) {
    mainContent = (
      <EmptyState
        onAddSnapshot={() => {
          openAddSnapshot();
        }}
      />
    );
  } else {
    mainContent = (
      <div className="dashboard__content">
        <SummaryCards data={data} currency={currency} />

        <div className="dashboard__charts">
          <TotalValueChart
            data={data}
            currency={currency}
            range={range}
            onRangeChange={setRange}
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
          onToggleTheme={toggleTheme}
          onAddSnapshot={() => {
            const active = document.activeElement;
            openAddSnapshot(
              active instanceof HTMLElement ? active : undefined,
            );
          }}
          onOpenSettings={() => {
            const active = document.activeElement;
            restoreFocusRef.current =
              active instanceof HTMLElement ? active : null;
            setSettingsDialogOpen(true);
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
            id: crypto.randomUUID(),
            tone: 'success',
            message,
          });
          reload();
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete snapshot?"
        description={
          deleteTarget
            ? `Delete the snapshot for ${formatSnapshotDate(deleteTarget.date)} with a total of ${formatMoney(deleteTarget.totalValueCents, currency)}? This cannot be undone.`
            : ''
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
          dashboard={data}
          restoreFocusTo={restoreFocusRef}
          onClose={() => {
            setSettingsDialogOpen(false);
          }}
          onToast={(tone, message) => {
            setToast({
              id: crypto.randomUUID(),
              tone,
              message,
            });
          }}
          onDataChanged={refreshAppData}
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
