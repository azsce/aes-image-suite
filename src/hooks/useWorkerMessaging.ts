import { useCallback } from "react";
import type { WorkerMessage, EncryptionMode } from "@/types/crypto.types";

/**
 * Custom hook for sending messages to the crypto worker
 *
 * Handles message construction and uses Transferable objects for efficient
 * data transfer to the worker thread (zero-copy transfer of ArrayBuffers).
 *
 * @param mode - Current encryption mode (ECB, CBC, or CTR)
 * @param getWorker - Function to get the worker instance
 * @returns Object with sendCryptoMessage function
 */
export function useWorkerMessaging(mode: EncryptionMode, getWorker: () => Worker) {
  /**
   * Sends a crypto operation message to the worker using Transferable objects
   *
   * Uses structured cloning with transfer list for efficient data transfer.
   * The ArrayBuffers are transferred (not copied) to the worker thread.
   *
   * @param type - Operation type ('ENCRYPT' or 'DECRYPT')
   * @param keyBytes - Encryption/decryption key as byte array
   * @param ivBytes - Initialization vector (optional, not used for ECB)
   * @param dataBits - Image bits to encrypt/decrypt
   */
  const sendCryptoMessage = useCallback(
    (type: "ENCRYPT" | "DECRYPT", keyBytes: Uint8Array, ivBytes: Uint8Array | undefined, dataBits: Uint8Array) => {
      const message: WorkerMessage = {
        type,
        payload: {
          bits: dataBits,
          key: keyBytes,
          iv: ivBytes,
          mode,
        },
      };

      const transferList = [dataBits.buffer, keyBytes.buffer];
      if (ivBytes) {
        transferList.push(ivBytes.buffer);
      }

      const worker = getWorker();
      worker.postMessage(message, transferList);
    },
    [mode, getWorker]
  );

  return { sendCryptoMessage };
}
