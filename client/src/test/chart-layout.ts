import type { ComponentProps } from 'react';
import { vi } from 'vitest';

export const CHART_TEST_WIDTH = 800;
export const CHART_TEST_HEIGHT = 400;

/**
 * Force fixed chart dimensions in tests. Recharts skips ResizeObserver when
 * both width and height are concrete numbers, which avoids zero-size warnings
 * in JSDOM while still rendering real chart children (LineChart, PieChart, …).
 */
vi.mock('recharts', async (importOriginal) => {
  const React = await import('react');
  const actual = await importOriginal<typeof import('recharts')>();

  function TestResponsiveContainer(
    props: ComponentProps<typeof actual.ResponsiveContainer>,
  ) {
    const { children, ...rest } = props;
    return React.createElement(
      actual.ResponsiveContainer,
      { ...rest, width: 800, height: 400, children },
    );
  }

  return {
    ...actual,
    ResponsiveContainer: TestResponsiveContainer,
  };
});

/**
 * Give JSDOM chart containers realistic layout metrics and a ResizeObserver
 * that reports those dimensions (belt-and-suspenders for any percentage-sized paths).
 */
export function installChartLayoutMocks(): void {
  class ResizeObserverStub implements ResizeObserver {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element): void {
      const width = CHART_TEST_WIDTH;
      const height = CHART_TEST_HEIGHT;
      const contentRect: DOMRectReadOnly = {
        x: 0,
        y: 0,
        width,
        height,
        top: 0,
        left: 0,
        bottom: height,
        right: width,
        toJSON: () => ({
          x: 0,
          y: 0,
          width,
          height,
          top: 0,
          left: 0,
          bottom: height,
          right: width,
        }),
      };

      this.callback(
        [
          {
            target,
            contentRect,
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        this,
      );
    }

    unobserve(): void {}

    disconnect(): void {}
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverStub);

  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return CHART_TEST_WIDTH;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return CHART_TEST_HEIGHT;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return CHART_TEST_WIDTH;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return CHART_TEST_HEIGHT;
    },
  });

  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: CHART_TEST_HEIGHT,
      right: CHART_TEST_WIDTH,
      width: CHART_TEST_WIDTH,
      height: CHART_TEST_HEIGHT,
      toJSON: () => ({}),
    };
  };
}

installChartLayoutMocks();
