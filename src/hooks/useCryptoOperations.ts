import { useCallback, useRef } from "react";
import type { EncryptionMode } from "@/types/crypto.types";
import type { ExtendedCryptoState } from "./useCryptoState";
import { useCryptoDataPreparation } from "./useCryptoDataPreparation";
import { useWorkerMessaging } from "./useWorkerMessaging";

interface CryptoOperationsParams {
  state: ExtendedCryptoState;
  getWorker: () => Worker;
  setProcessing: (isProcessing: boolean) => void;
  setError: (error: string) => void;
  validateOperation: (
    isEncryption: boolean,
    data: { body: Uint8Array | null; encryptedBody: Uint8Array | null; mode: EncryptionMode }
  ) => string | null;
}

/**
 * Custom hook for managing crypto operations (encrypt/decrypt)
 *
 * This hook orchestrates the encryption and decryption workflow by:
 * 1. Validating operation prerequisites (data, keys, mode)
 * 2. Preparing crypto data (converting hex to bytes)
 * 3. Dispatching operations to Web Worker
 * 4. Handling errors and processing states
 *
 * @param params - Operation parameters including state, worker, and callbacks
 * @returns Object with encrypt/decrypt handlers and operation reference
 */
export function useCryptoOperations(params: CryptoOperationsParams) {
  const { state, getWorker, setProcessing, setError, validateOperation } = params;
  const operationRef = useRef<"encrypt" | "decrypt" | null>(null);
  const { prepareCryptoData } = useCryptoDataPreparation(state);
  const { sendCryptoMessage } = useWorkerMessaging(state.mode, getWorker);

  /**
   * Validates operation prerequisites and prepares crypto data
   * @param isEncryption - True for encryption, false for decryption
   * @returns Prepared crypto data or null if validation fails
   */
  const validateAndPrepare = useCallback(
    (isEncryption: boolean) => {
      const validationError = validateOperation(isEncryption, {
        body: state.body,
        encryptedBody: state.encryptedBody,
        mode: state.mode,
      });

      if (validationError) {
        setError(validationError);
        return null;
      }

      return prepareCryptoData(isEncryption);
    },
    [validateOperation, prepareCryptoData, setError, state.body, state.encryptedBody, state.mode]
  );

  /**
   * Executes crypto operation by sending message to Web Worker
   * @param messageType - Type of operation ('ENCRYPT' or 'DECRYPT')
   * @param operationType - Operation name for error messages
   * @param cryptoData - Prepared crypto data (key, IV, data bytes)
   */
  const executeOperation = useCallback(
    (
      messageType: "ENCRYPT" | "DECRYPT",
      operationType: "encrypt" | "decrypt",
      cryptoData: { keyBytes: Uint8Array; ivBytes: Uint8Array | undefined; dataBytes: Uint8Array }
    ) => {
      try {
        operationRef.current = operationType;
        sendCryptoMessage(messageType, cryptoData.keyBytes, cryptoData.ivBytes, cryptoData.dataBytes);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : `${operationType} failed`;
        setError(`${operationType.charAt(0).toUpperCase() + operationType.slice(1)} error: ${errorMessage}`);
      }
    },
    [sendCryptoMessage, setError]
  );

  /**
   * Main crypto operation executor with full validation and error handling
   * @param isEncryption - True for encryption, false for decryption
   * @param messageType - Worker message type
   * @param operationType - Operation name for tracking
   */
  const executeCryptoOperation = useCallback(
    (isEncryption: boolean, messageType: "ENCRYPT" | "DECRYPT", operationType: "encrypt" | "decrypt") => {
      const cryptoData = validateAndPrepare(isEncryption);

      if (!cryptoData) {
        return;
      }

      setProcessing(true);
      executeOperation(messageType, operationType, cryptoData);
    },
    [validateAndPrepare, setProcessing, executeOperation]
  );

  /**
   * Handle encryption
   */
  const handleEncrypt = useCallback(() => {
    executeCryptoOperation(true, "ENCRYPT", "encrypt");
  }, [executeCryptoOperation]);

  /**
   * Handle decryption
   */
  const handleDecrypt = useCallback(() => {
    executeCryptoOperation(false, "DECRYPT", "decrypt");
  }, [executeCryptoOperation]);

  return {
    operationRef,
    handleEncrypt,
    handleDecrypt,
  };
}
