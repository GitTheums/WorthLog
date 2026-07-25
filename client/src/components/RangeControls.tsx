import type { DashboardRange } from '../api/types';
import './RangeControls.css';

const RANGES: Array<{ value: DashboardRange; label: string }> = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
];

interface RangeControlsProps {
  value: DashboardRange;
  onChange: (range: DashboardRange) => void;
}

export function RangeControls({ value, onChange }: RangeControlsProps) {
  return (
    <div
      className="range-controls"
      role="group"
      aria-label="Dashboard date range"
    >
      {RANGES.map((range) => {
        const selected = range.value === value;
        return (
          <button
            key={range.value}
            type="button"
            className={
              selected
                ? 'range-controls__button range-controls__button--active'
                : 'range-controls__button'
            }
            aria-pressed={selected}
            onClick={() => {
              onChange(range.value);
            }}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
