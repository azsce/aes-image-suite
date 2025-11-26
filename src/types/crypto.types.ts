/**
 * AES encryption mode types
 */
export type EncryptionMode = "ECB" | "CBC" | "CTR";

/**
 * Image metadata extracted from uploaded files
 */
export interface ImageMetadata {
  width: number; // Image width in pixels
  height: number; // Image height in pixels
  mimeType: string; // Original MIME type (e.g., "image/png")
  filename: string; // Original filename with extension
  fileSize: number; // Original file size in bytes
}

/**
 * Binary key file data structure
 */
export interface KeyFileData {
  key: Uint8Array; // Encryption key (16, 24, or 32 bytes for AES-128/192/256)
  iv?: Uint8Array; // Initialization vector (16 bytes, optional for ECB mode)
}

/**
 * Main application state for crypto operations
 */
export interface CryptoState {
  originalBits: Uint8Array | null;
  encryptedBits: Uint8Array | null;
  decryptedBits: Uint8Array | null;
  encryptedUrl: string | null;
  decryptedUrl: string | null;
  metadata: ImageMetadata | null;
  key: string; // hex string (32/48/64 characters for 128/192/256-bit key)
  iv: string; // hex string (32 characters for 128-bit IV)
  mode: EncryptionMode;
  isProcessing: boolean;
  error: string | null;
}

/**
 * Message types for Web Worker communication
 */
export interface WorkerMessage {
  type: "ENCRYPT" | "DECRYPT" | "RESULT" | "ERROR";
  payload?: {
    bits?: Uint8Array;
    key?: Uint8Array;
    iv?: Uint8Array;
    mode?: EncryptionMode;
    error?: string;
  };
}
