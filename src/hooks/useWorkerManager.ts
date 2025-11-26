import { useRef, useCallback, useEffect } from "react";
import type { WorkerMessage } from "@/types/crypto.types";

interface WorkerManagerProps {
  onResult: (bits: Uint8Array | undefined) => void;
  onError: (error: string) => void;
}

/**
 * Custom hook for managing Web Worker lifecycle and communication
 *
 * This hook handles:
 * - Lazy initialization of the crypto worker
 * - Message handling (results and errors)
 * - Cleanup on component unmount
 *
 * The worker is only created when first needed, improving initial load performance.
 *
 * @param props - Callbacks for handling worker results and errors
 * @returns Object with getWorker function for accessing the worker instance
 */
export function useWorkerManager({ onResult, onError }: WorkerManagerProps) {
  const workerRef = useRef<Worker | null>(null);

  /**
   * Lazily initializes and returns the Web Worker instance
   *
   * The worker is created on first call and reused for subsequent calls.
   * This pattern improves performance by deferring worker creation until needed.
   *
   * @returns The initialized Worker instance
   */
  const getWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("../workers/crypto.worker.ts", import.meta.url), { type: "module" });

      workerRef.current.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        if (message.type === "RESULT") {
          onResult(message.payload?.bits);
        } else if (message.type === "ERROR") {
          onError(message.payload?.error || "Unknown worker error");
        }
      };

      workerRef.current.onerror = (event: ErrorEvent) => {
        onError(`Worker error: ${event.message}`);
      };
    }
    return workerRef.current;
  }, [onResult, onError]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return { getWorker };
}
