/* eslint-disable no-console */

/**
 * Logger utility that wraps console methods and only logs in development mode
 */
const isDevelopment = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (isDevelopment) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDevelopment) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (isDevelopment) console.error(...args);
  },
  debug: (...args: unknown[]) => {
    if (isDevelopment) console.debug(...args);
  },
  trace: (...args: unknown[]) => {
    if (isDevelopment) console.trace(...args);
  },
  table: (...args: unknown[]) => {
    if (isDevelopment) console.table(...args);
  },
  group: (...args: unknown[]) => {
    if (isDevelopment) console.group(...args);
  },
  groupCollapsed: (...args: unknown[]) => {
    if (isDevelopment) console.groupCollapsed(...args);
  },
  groupEnd: () => {
    if (isDevelopment) console.groupEnd();
  },
  time: (label?: string) => {
    if (isDevelopment) console.time(label);
  },
  timeEnd: (label?: string) => {
    if (isDevelopment) console.timeEnd(label);
  },
  timeLog: (label?: string, ...args: unknown[]) => {
    if (isDevelopment) console.timeLog(label, ...args);
  },
};
