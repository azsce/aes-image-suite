import { useState, useCallback } from "react";
import type { EncryptionMode } from "@/types/crypto.types";
import { generateKey, generateIV } from "@/utils/hexUtils";

/**
 * Extended state to track encrypted body bits and original URL
 * Note: This interface is obsolete and should be removed
 */
export interface ExtendedCryptoState {
  originalBmp: Uint8Array | null; // Obsolete: kept for backward compatibility
  header: Uint8Array | null; // Obsolete: kept for backward compatibility
  body: Uint8Array | null; // Obsolete: kept for backward compatibility
  encryptedUrl: string | null;
  decryptedUrl: string | null;
  encryptedBody: Uint8Array | null;
  originalUrl: string | null;
  key: string;
  iv: string;
  mode: EncryptionMode;
  isProcessing: boolean;
  error: string | null;
}

/**
 * Hook for managing crypto state
 */
export function useCryptoState() {
  const [state, setState] = useState<ExtendedCryptoState>({
    originalBmp: null,
    header: null,
    body: null,
    encryptedUrl: null,
    decryptedUrl: null,
    encryptedBody: null,
    originalUrl: null,
    key: generateKey(),
    iv: generateIV(),
    mode: "ECB",
    isProcessing: false,
    error: null,
  });

  const setProcessing = useCallback((isProcessing: boolean) => {
    setState(prev => ({ ...prev, isProcessing, error: null }));
  }, []);

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, error, isProcessing: false }));
  }, []);

  const updateKey = useCallback((key: string) => {
    setState(prev => ({ ...prev, key }));
  }, []);

  const updateIV = useCallback((iv: string) => {
    setState(prev => ({ ...prev, iv }));
  }, []);

  const updateMode = useCallback((mode: EncryptionMode) => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  const generateNewKey = useCallback(() => {
    setState(prev => ({ ...prev, key: generateKey() }));
  }, []);

  const generateNewIV = useCallback(() => {
    setState(prev => ({ ...prev, iv: generateIV() }));
  }, []);

  const resetState = useCallback(() => {
    setState({
      originalBmp: null,
      header: null,
      body: null,
      encryptedUrl: null,
      decryptedUrl: null,
      encryptedBody: null,
      originalUrl: null,
      key: generateKey(),
      iv: generateIV(),
      mode: "ECB",
      isProcessing: false,
      error: null,
    });
  }, []);

  return {
    state,
    setState,
    setProcessing,
    setError,
    updateKey,
    updateIV,
    updateMode,
    generateNewKey,
    generateNewIV,
    resetState,
  };
}
