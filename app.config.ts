/**
 * Application Configuration
 * Central configuration file for app-wide settings
 */

export const appConfig = {
  /**
   * File upload configuration
   */
  upload: {
    /**
     * Maximum file size in megabytes
     * @default 30
     */
    maxFileSizeMB: 30,

    /**
     * Maximum file size in bytes (computed)
     */
    get maxFileSizeBytes(): number {
      return this.maxFileSizeMB * 1024 * 1024;
    },

    /**
     * Accepted image MIME types
     * Supports all common image formats for lossless encryption
     */
    acceptedImageTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/bmp",
      "image/tiff",
      "image/svg+xml",
      "image/avif",
      "image/apng",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ] as const,

    /**
     * Accepted image file extensions
     */
    acceptedImageExtensions: [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".bmp",
      ".tiff",
      ".tif",
      ".svg",
      ".avif",
      ".apng",
      ".ico",
    ] as const,

    /**
     * Accept attribute for file input (all image types)
     */
    get acceptAttribute(): string {
      return "image/*";
    },
  },

  /**
   * Encryption configuration
   */
  encryption: {
    /**
     * Available AES key sizes in bits
     * Supports AES-128, AES-192, and AES-256
     */
    keySizes: [128, 192, 256] as const,

    /**
     * Default AES key size in bits
     * @default 256
     */
    defaultKeySize: 256 as 128 | 192 | 256,

    /**
     * Get key length in hex characters for a given key size
     * @param keySize - Key size in bits (128, 192, or 256)
     * @returns Key length in hex characters
     */
    getKeyLengthHex(keySize: 128 | 192 | 256): number {
      return keySize / 4;
    },

    /**
     * Get key length in bytes for a given key size
     * @param keySize - Key size in bits (128, 192, or 256)
     * @returns Key length in bytes
     */
    getKeyLengthBytes(keySize: 128 | 192 | 256): number {
      return keySize / 8;
    },

    /**
     * IV length in bits (always 128 for AES)
     * @default 128
     */
    ivLengthBits: 128,

    /**
     * IV length in hex characters (computed)
     */
    get ivLengthHex(): number {
      return this.ivLengthBits / 4;
    },

    /**
     * IV length in bytes (computed)
     */
    get ivLengthBytes(): number {
      return this.ivLengthBits / 8;
    },

    /**
     * Available encryption methods
     */
    methods: ["ECB", "CBC", "CTR"] as const,
  },

  /**
   * UI configuration
   */
  ui: {
    /**
     * Animation durations in milliseconds
     */
    animation: {
      tabTransition: 300,
      microInteraction: 150,
      successFeedback: 2000,
    },

    /**
     * Image viewer configuration
     */
    imageViewer: {
      minZoom: 0.1,
      maxZoom: 5,
      zoomStep: 0.25,
    },
  },
} as const;

export type AppConfig = typeof appConfig;
export type EncryptionMethod = (typeof appConfig.encryption.methods)[number];
export type AcceptedImageType = (typeof appConfig.upload.acceptedImageTypes)[number];
export type KeySize = (typeof appConfig.encryption.keySizes)[number];
