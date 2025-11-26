import { useState, useCallback } from "react";
import type { EncryptionMode } from "@/types/crypto.types";

interface ValidationState {
  isKeyValid: boolean;
  isIVValid: boolean;
}

interface ValidationParams {
  body: Uint8Array | null;
  encryptedBody: Uint8Array | null;
  mode: EncryptionMode;
}

/**
 * Validate data availability
 */
function validateDataAvailability(isEncryption: boolean, params: ValidationParams): string | null {
  if (isEncryption && !params.body) {
    return "Please upload an image before encrypting";
  }

  if (!isEncryption && !params.encryptedBody) {
    return "Please encrypt an image before attempting to decrypt";
  }

  return null;
}

/**
 * Validate key
 */
function validateKey(isKeyValid: boolean): string | null {
  if (!isKeyValid) {
    return "Invalid encryption key. Please enter a valid 64-character hexadecimal key or generate a new one";
  }
  return null;
}

/**
 * Validate IV
 */
function validateIV(mode: EncryptionMode, isIVValid: boolean): string | null {
  if (mode !== "ECB" && !isIVValid) {
    const label = mode === "CTR" ? "counter" : "IV";
    return `Invalid ${label}. Please enter a valid 32-character hexadecimal value or generate a new one`;
  }
  return null;
}

/**
 * Manages validation state and validation logic
 */
export function useCryptoValidation() {
  const [validation, setValidation] = useState<ValidationState>({
    isKeyValid: true,
    isIVValid: true,
  });

  const validateOperation = useCallback(
    (isEncryption: boolean, params: ValidationParams): string | null => {
      return (
        validateDataAvailability(isEncryption, params) ||
        validateKey(validation.isKeyValid) ||
        validateIV(params.mode, validation.isIVValid)
      );
    },
    [validation.isKeyValid, validation.isIVValid]
  );

  const setKeyValid = useCallback((isValid: boolean) => {
    setValidation(prev => ({ ...prev, isKeyValid: isValid }));
  }, []);

  const setIVValid = useCallback((isValid: boolean) => {
    setValidation(prev => ({ ...prev, isIVValid: isValid }));
  }, []);

  const resetValidation = useCallback(() => {
    setValidation({ isKeyValid: true, isIVValid: true });
  }, []);

  return { validation, validateOperation, setKeyValid, setIVValid, resetValidation };
}
