/**
 * Narrow logging surface for injectable server diagnostics.
 * Production uses the console; tests may pass spies or silent sinks.
 */
export interface AppLogger {
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: unknown, ...args: unknown[]) => void;
}

export const consoleLogger: AppLogger = {
  warn: (message, ...args) => {
    console.warn(message, ...args);
  },
  error: (message, ...args) => {
    console.error(message, ...args);
  },
};
