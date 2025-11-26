/* eslint-disable no-console */

import { encrypt, decrypt } from "@/utils/cryptoEngine";
import type { WorkerMessage } from "@/types/crypto.types";
// import { logger } from '@/utils/logger'

/**
 * Web Worker for performing AES encryption/decryption operations
 *
 * LOSSLESS ENCRYPTION: This worker performs bit-level AES encryption/decryption
 * on raw file bits without any preprocessing or format conversion. The operations
 * are performed in a separate thread to avoid blocking the UI.
 *
 * PERFORMANCE: Uses transferable objects (ArrayBuffer transfer) to avoid copying
 * large data arrays between threads, improving performance for large files.
 *
 * Offloads CPU-intensive crypto operations from the main thread to maintain
 * responsive UI during encryption/decryption.
 */

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  try {
    if (type === "ENCRYPT") {
      handleEncrypt(payload);
    } else if (type === "DECRYPT") {
      handleDecrypt(payload);
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    handleError(error);
  }
};

/**
 * Handle encryption request from main thread
 *
 * LOSSLESS ENCRYPTION PROCESS:
 * 1. Receive raw file bits from main thread
 * 2. Apply AES encryption with specified mode (ECB, CBC, or CTR)
 * 3. Add PKCS7 padding for block modes (ECB, CBC)
 * 4. Return encrypted bits to main thread
 *
 * The encrypted bits can be decrypted to recover the exact original file.
 */
function handleEncrypt(payload: WorkerMessage["payload"]): void {
  console.log("[Worker] Starting encryption", { mode: payload?.mode, dataSize: payload?.bits?.length });

  if (!payload || !payload.bits || !payload.key || !payload.mode) {
    throw new Error("Missing required encryption parameters");
  }

  const { bits, key, mode, iv } = payload;

  // Perform encryption on raw bits (lossless - no format conversion)
  const encryptedBits = encrypt(bits, key, mode, iv);
  console.log("[Worker] Encryption complete", { resultSize: encryptedBits.length });

  // Send result back to main thread using transferable objects
  const response: WorkerMessage = {
    type: "RESULT",
    payload: { bits: encryptedBits },
  };

  console.log("[Worker] Posting result back to main thread");
  // Transfer ArrayBuffer ownership to avoid copying (zero-copy transfer)
  // This is much faster than copying large arrays between threads
  self.postMessage(response, { transfer: [encryptedBits.buffer] });
  console.log("[Worker] Result posted");
}

/**
 * Handle decryption request from main thread
 *
 * LOSSLESS DECRYPTION PROCESS:
 * 1. Receive encrypted bits from main thread
 * 2. Apply AES decryption with specified mode (ECB, CBC, or CTR)
 * 3. Remove PKCS7 padding for block modes (ECB, CBC)
 * 4. Return decrypted bits to main thread
 *
 * The decrypted bits are bit-identical to the original file before encryption.
 */
function handleDecrypt(payload: WorkerMessage["payload"]): void {
  console.log("[Worker] Starting decryption", { mode: payload?.mode, dataSize: payload?.bits?.length });

  if (!payload || !payload.bits || !payload.key || !payload.mode) {
    throw new Error("Missing required decryption parameters");
  }

  const { bits, key, mode, iv } = payload;

  // Perform decryption on encrypted bits (lossless - recovers exact original)
  const decryptedBits = decrypt(bits, key, mode, iv);
  console.log("[Worker] Decryption complete", { resultSize: decryptedBits.length });

  // Send result back to main thread using transferable objects
  const response: WorkerMessage = {
    type: "RESULT",
    payload: { bits: decryptedBits },
  };

  console.log("[Worker] Posting result back to main thread");
  // Transfer ArrayBuffer ownership to avoid copying (zero-copy transfer)
  // This is much faster than copying large arrays between threads
  self.postMessage(response, { transfer: [decryptedBits.buffer] });
  console.log("[Worker] Result posted");
}

/**
 * Handle errors and send error message to main thread
 */
function handleError(error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

  const response: WorkerMessage = {
    type: "ERROR",
    payload: { error: errorMessage },
  };

  self.postMessage(response);
}
