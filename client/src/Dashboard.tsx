import { useEffect, useState, type ReactNode } from 'react';
import type { DashboardRange } from './api/types';
import { AllocationChart } from './components/AllocationChart';
import { CategoryCards } from './components/CategoryCards';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import { Header } from './components/Header';
import { HistoryTable } from './components/HistoryTable';
import { PlaceholderDialog } from './components/PlaceholderDialog';
import { DashboardSkeleton } from './components/Skeleton';
import { SummaryCards } from './components/SummaryCards';
import { TotalValueChart } from './components/TotalValueChart';
import { useDashboard } from './hooks/useDashboard';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import './Dashboard.css';

export function Dashboard() {
  const { theme, toggleTheme } = useTheme();
  const {
    settings,
    loading: settingsLoading,
    error: settingsError,
  } = useSettings();
  const [range, setRange] = useState<DashboardRange | null>(null);
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

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
          setSnapshotDialogOpen(true);
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
        <HistoryTable data={data} currency={currency} />
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
            setSnapshotDialogOpen(true);
          }}
          onOpenSettings={() => {
            setSettingsDialogOpen(true);
          }}
        />

        <main className="dashboard__main">{mainContent}</main>
      </div>

      <PlaceholderDialog
        open={snapshotDialogOpen}
        title="Add snapshot"
        description="The snapshot editor will be available in a later update. Use this button later to record category totals for a selected date."
        onClose={() => {
          setSnapshotDialogOpen(false);
        }}
      />

      <PlaceholderDialog
        open={settingsDialogOpen}
        title="Settings"
        description="Settings will be available in a later update. You will be able to change currency and the default dashboard range here."
        onClose={() => {
          setSettingsDialogOpen(false);
        }}
      />
    </div>
  );
}
