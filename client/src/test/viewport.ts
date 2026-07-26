import { vi } from 'vitest';

/**
 * Mock matchMedia so layout hooks can target mobile / tablet / desktop widths.
 */
export function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => {
      let matches = false;

      if (query.includes('prefers-color-scheme')) {
        matches = false;
      } else if (query.includes(' and ')) {
        const min = /min-width:\s*(\d+)px/.exec(query);
        const max = /max-width:\s*(\d+)px/.exec(query);
        const minWidth = min ? Number(min[1]) : Number.NEGATIVE_INFINITY;
        const maxWidth = max ? Number(max[1]) : Number.POSITIVE_INFINITY;
        matches = width >= minWidth && width <= maxWidth;
      } else {
        const max = /max-width:\s*(\d+)px/.exec(query);
        const min = /min-width:\s*(\d+)px/.exec(query);
        if (max) {
          matches = width <= Number(max[1]);
        } else if (min) {
          matches = width >= Number(min[1]);
        }
      }

      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    },
  });
}
