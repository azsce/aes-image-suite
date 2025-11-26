import { useCallback } from "react";
import type { ExtendedCryptoState } from "./useCryptoState";

interface WorkerResultHandlerParams {
  setState: React.Dispatch<React.SetStateAction<ExtendedCryptoState>>;
  revokeUrl: (url: string) => void;
  addUrl: (url: string) => void;
  operationRef: React.RefObject<"encrypt" | "decrypt" | null>;
}

/**
 * Create encryption result state
 */
function buildEncryptionState(prev: ExtendedCryptoState, url: string, bytes: Uint8Array): ExtendedCryptoState {
  return {
    ...prev,
    encryptedUrl: url,
    encryptedBody: bytes,
    isProcessing: false,
    error: null,
  };
}

/**
 * Create decryption result state
 */
function buildDecryptionState(prev: ExtendedCryptoState, url: string): ExtendedCryptoState {
  return {
    ...prev,
    decryptedUrl: url,
    isProcessing: false,
    error: null,
  };
}

/**
 * Create error state
 */
function buildErrorState(prev: ExtendedCryptoState, error: string): ExtendedCryptoState {
  return {
    ...prev,
    error,
    isProcessing: false,
  };
}

/**
 * Hook for handling worker results
 */
export function useWorkerResultHandler(params: WorkerResultHandlerParams) {
  const { setState, revokeUrl, addUrl, operationRef } = params;

  const createBlobUrl = useCallback(
    (_header: Uint8Array, bytes: Uint8Array): string => {
      // Note: This hook is obsolete and should be removed
      // Keeping minimal implementation for backward compatibility
      const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      addUrl(url);
      return url;
    },
    [addUrl]
  );

  const processResult = useCallback(
    (prev: ExtendedCryptoState, bytes: Uint8Array, header: Uint8Array) => {
      const isEncryption = operationRef.current === "encrypt";
      const oldUrl = isEncryption ? prev.encryptedUrl : prev.decryptedUrl;

      if (oldUrl) {
        revokeUrl(oldUrl);
      }

      const url = createBlobUrl(header, bytes);
      return isEncryption ? buildEncryptionState(prev, url, bytes) : buildDecryptionState(prev, url);
    },
    [operationRef, revokeUrl, createBlobUrl]
  );

  const handleWorkerResult = useCallback(
    (bytes: Uint8Array | undefined) => {
      if (!bytes) {
        setState(prev => buildErrorState(prev, "No bytes returned from worker"));
        return;
      }

      setState(prev => {
        if (!prev.header) {
          return buildErrorState(prev, "No header available");
        }
        return processResult(prev, bytes, prev.header);
      });
    },
    [setState, processResult]
  );

  const handleWorkerError = useCallback(
    (error: string) => {
      setState(prev => buildErrorState(prev, error));
    },
    [setState]
  );

  return {
    handleWorkerResult,
    handleWorkerError,
    createBlobUrl,
  };
}
