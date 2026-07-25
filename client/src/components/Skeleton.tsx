import type { CSSProperties } from 'react';
import './Skeleton.css';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard</span>
      <div className="dashboard-skeleton__summary">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="dashboard-skeleton__card" />
        ))}
      </div>
      <div className="dashboard-skeleton__main">
        <Skeleton className="dashboard-skeleton__chart" />
        <Skeleton className="dashboard-skeleton__side" />
      </div>
      <div className="dashboard-skeleton__categories">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="dashboard-skeleton__category" />
        ))}
      </div>
      <Skeleton className="dashboard-skeleton__table" />
    </div>
  );
}
