/**
 * Store type definitions for the AES Image Encryption Suite
 */

import type { ImageMetadata } from "./crypto.types";
import type { EncryptionMethodType } from "./encryption-method.types";

export type EncryptionMethod = "ECB" | "CBC" | "CTR";
export type ActiveTab = "encryption" | "decryption" | "comparison";
export type KeySize = 128 | 192 | 256;

/**
 * Encrypted result for a specific method and approach combination
 *
 * Stores the encrypted image visualization and raw encrypted bits
 * along with a timestamp for debugging purposes.
 */
export interface EncryptedResult {
  /** Blob URL for displaying encrypted image visualization in UI */
  encryptedImage: string;
  /** Raw encrypted bits (actual encrypted data) */
  encryptedBits: Uint8Array;
  /** Timestamp when this encryption was performed */
  timestamp: number;
}

/**
 * Cache for encrypted results of current key+image combination
 *
 * This cache stores all encrypted results for different method and approach
 * combinations for the current key and image pair. The entire cache is
 * destroyed when either the encryption key or the source image changes.
 *
 * Structure: method → approach → result
 * Example: cache.results.ECB["whole-file"] = { encryptedImage, encryptedBits, timestamp }
 */
export interface EncryptionCache {
  /**
   * Unique identifier for this cache (SHA-256 hash of key + image bits)
   * Used for validation and debugging
   */
  cacheKey: string;

  /**
   * Initialization Vector stored with this cache
   * Preserved across method changes but destroyed when key/image changes
   */
  iv: string;

  /**
   * Nested map of encrypted results: method → approach → result
   * Each combination is lazily computed and cached on first access
   */
  results: {
    ECB?: {
      "whole-file"?: EncryptedResult;
      "pixel-data"?: EncryptedResult;
    };
    CBC?: {
      "whole-file"?: EncryptedResult;
      "pixel-data"?: EncryptedResult;
    };
    CTR?: {
      "whole-file"?: EncryptedResult;
      "pixel-data"?: EncryptedResult;
    };
  };
}

/**
 * Encryption mode state
 *
 * Manages the encryption workflow including input data, encryption parameters,
 * and cached results for different encryption method/approach combinations.
 */
export interface EncryptionState {
  /** Current encryption method (ECB, CBC, or CTR) */
  method: EncryptionMethod;

  /** AES key size in bits (128, 192, or 256) */
  keySize: KeySize;

  /** Encryption key as hex string */
  key: string;

  /** Blob URL for displaying original image in UI */
  originalImage: string | null;

  /** Raw bits of original image file (used for encryption) */
  originalBits: Uint8Array | null;

  /** Image metadata (dimensions, MIME type, filename, size) */
  metadata: ImageMetadata | null;

  /** Whether encryption is currently in progress */
  isProcessing: boolean;

  /** Error message if encryption failed */
  error: string | null;

  /** Current encryption approach (whole-file or pixel-data) */
  encryptionMethod: EncryptionMethodType;

  /**
   * Cache of encrypted results for current key+image combination
   * Null when no image/key is loaded or after key/image changes
   */
  currentCache: EncryptionCache | null;
}

/**
 * Decryption mode state
 */
export interface DecryptionState {
  method: EncryptionMethod;
  keySize: KeySize; // AES key size in bits (128, 192, or 256)
  key: string; // hex string
  iv: string; // hex string
  encryptedImage: string | null; // data URL
  decryptedImage: string | null; // data URL
  encryptedBits: Uint8Array | null; // Encrypted bits
  decryptedBits: Uint8Array | null; // Decrypted bits
  metadata: ImageMetadata | null; // Image metadata
  isProcessing: boolean;
  error: string | null;
}

/**
 * Comparison result details for bit-level comparison
 */
export interface ComparisonResult {
  identical: boolean; // True if 100% bit-perfect match
  differenceCount: number; // Number of differing bits
  totalBits: number; // Total bits compared
  differencePercentage: number; // 0-100
  sizeMismatch: boolean; // True if file sizes differ
  details: string; // Human-readable summary
}

/**
 * Comparison mode state
 */
export interface ComparisonState {
  imageA: string | null; // data URL
  imageB: string | null; // data URL
  isProcessing: boolean;
  result: ComparisonResult | null;
  error: string | null;
}

/**
 * Complete application store state
 */
export interface AppState {
  // Global state
  activeTab: ActiveTab;
  theme: "light" | "dark";

  // Mode states
  encryption: EncryptionState;
  decryption: DecryptionState;
  comparison: ComparisonState;
}

/**
 * Encryption mode actions
 */
export interface EncryptionActions {
  /** Set the encryption method (ECB, CBC, or CTR) */
  setEncryptionMethod: (method: EncryptionMethod) => void;

  /** Set the AES key size (128, 192, or 256 bits) */
  setEncryptionKeySize: (keySize: KeySize) => void;

  /** Set the encryption key (hex string) - clears cache */
  setEncryptionKey: (key: string) => void;

  /** Set the original image Blob URL for display */
  setOriginalImage: (image: string | null) => void;

  /** Set the original image raw bits - clears cache */
  setOriginalBits: (bits: Uint8Array | null) => void;

  /** Set the image metadata */
  setEncryptionMetadata: (metadata: ImageMetadata | null) => void;

  /** Set the processing state */
  setEncryptionProcessing: (isProcessing: boolean) => void;

  /** Set the error message */
  setEncryptionError: (error: string | null) => void;

  /** Reset all encryption state */
  resetEncryption: () => void;

  /** Set the encryption approach (whole-file or pixel-data) */
  setFileEncryptionMethod: (method: EncryptionMethodType) => void;

  /** Set the entire cache object */
  setEncryptionCache: (cache: EncryptionCache | null) => void;

  /**
   * Update a specific result in the cache
   * Creates cache if it doesn't exist
   */
  updateEncryptionCacheResult: (
    method: EncryptionMethod,
    approach: EncryptionMethodType,
    result: EncryptedResult
  ) => void;

  /**
   * Set the IV in the current cache
   * Creates cache if it doesn't exist
   */
  setCurrentIV: (iv: string) => void;
}

/**
 * Decryption mode actions
 */
export interface DecryptionActions {
  setDecryptionMethod: (method: EncryptionMethod) => void;
  setDecryptionKeySize: (keySize: KeySize) => void;
  setDecryptionKey: (key: string) => void;
  setDecryptionIV: (iv: string) => void;
  setEncryptedImageForDecryption: (image: string | null) => void;
  setDecryptedImage: (image: string | null) => void;
  setEncryptedBitsForDecryption: (bits: Uint8Array | null) => void;
  setDecryptedBits: (bits: Uint8Array | null) => void;
  setDecryptionMetadata: (metadata: ImageMetadata | null) => void;
  setDecryptionProcessing: (isProcessing: boolean) => void;
  setDecryptionError: (error: string | null) => void;
  resetDecryption: () => void;
}

/**
 * Comparison mode actions
 */
export interface ComparisonActions {
  setComparisonImageA: (image: string | null) => void;
  setComparisonImageB: (image: string | null) => void;
  setComparisonProcessing: (isProcessing: boolean) => void;
  setComparisonResult: (result: ComparisonResult | null) => void;
  setComparisonError: (error: string | null) => void;
  resetComparison: () => void;
}

/**
 * Global actions
 */
export interface GlobalActions {
  setActiveTab: (tab: ActiveTab) => void;
  setTheme: (theme: "light" | "dark") => void;
}

/**
 * Complete store interface combining state and actions
 */
export interface AppStore extends AppState, EncryptionActions, DecryptionActions, ComparisonActions, GlobalActions {}

/**
 * Persisted state structure (excludes sensitive data and large binary data)
 *
 * Note: Keys, IVs, images, and encrypted results are intentionally excluded
 * for security and performance - they are destroyed on page reload.
 * The cache is also excluded as it contains large binary data.
 */
export interface PersistedState {
  activeTab: ActiveTab;
  theme: "light" | "dark";
  encryption: {
    method: EncryptionMethod;
    keySize: KeySize;
    metadata: ImageMetadata | null;
    encryptionMethod: EncryptionMethodType;
  };
  decryption: {
    method: EncryptionMethod;
    keySize: KeySize;
    metadata: ImageMetadata | null;
  };
}
