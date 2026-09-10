import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import type { DashboardRange } from '../api/types';
import './RangeControls.css';

const RANGES: Array<{ value: DashboardRange; label: string; description: string }> = [
  { value: '1m', label: '1M', description: 'Last month' },
  { value: '3m', label: '3M', description: 'Last three months' },
  { value: '1y', label: '1Y', description: 'Last year' },
  { value: 'all', label: 'All', description: 'All time' },
];

interface RangeControlsProps {
  value: DashboardRange;
  onChange: (range: DashboardRange) => void;
}

export function RangeControls({ value, onChange }: RangeControlsProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    RANGES.findIndex((range) => range.value === value),
  );

  const focusIndex = (index: number) => {
    const clamped = (index + RANGES.length) % RANGES.length;
    buttonRefs.current[clamped]?.focus();
  };

  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusIndex(index + 1);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusIndex(index - 1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusIndex(RANGES.length - 1);
    }
  };

  return (
    <div
      className="range-controls"
      role="group"
      aria-label="Dashboard date range"
      style={{ '--range-index': selectedIndex } as CSSProperties}
    >
      <span className="range-controls__thumb" aria-hidden="true" />
      {RANGES.map((range, index) => {
        const selected = range.value === value;
        return (
          <button
            key={range.value}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            className={
              selected
                ? 'range-controls__button range-controls__button--active'
                : 'range-controls__button'
            }
            aria-pressed={selected}
            title={range.description}
            onClick={() => {
              onChange(range.value);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
