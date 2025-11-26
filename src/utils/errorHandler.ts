// Global error handler for unhandled errors and promise rejections

export function setupGlobalErrorHandlers(): void {
  // Handle unhandled errors
  window.addEventListener("error", (event: ErrorEvent) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("Unhandled error:", event.error);
    }
    // Prevent default browser error handling
    event.preventDefault();
  });

  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("Unhandled promise rejection:", event.reason);
    }
    // Prevent default browser error handling
    event.preventDefault();
  });
}

// Utility to safely execute async operations
export async function safeAsync<T>(fn: () => Promise<T>, fallback?: T): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("Async operation failed:", error);
    }
    return fallback;
  }
}

// Utility to safely execute sync operations
export function safeSync<T>(fn: () => T, fallback?: T): T | undefined {
  try {
    return fn();
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("Sync operation failed:", error);
    }
    return fallback;
  }
}
