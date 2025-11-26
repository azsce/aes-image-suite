// Application Utilities - JSZip
import JSZip from "jszip";

// TypeScript Types
import type { EncryptionMode, ImageMetadata, KeyFileData } from "../types/crypto.types";

// ============================================================================
// 🏷️ BRANDED TYPES
// ============================================================================

/**
 * Branded type for temporary directory paths
 */
export type TempDirPath = string & { readonly __brand: "TempDirPath" };

/**
 * Branded type for encrypted image file paths
 */
export type EncryptedImagePath = string & { readonly __brand: "EncryptedImagePath" };

/**
 * Branded type for key file paths
 */
export type KeyFilePath = string & { readonly __brand: "KeyFilePath" };

/**
 * Branded type for bundle file paths
 */
export type BundlePath = string & { readonly __brand: "BundlePath" };

/**
 * Create a branded TempDirPath
 */
export function asTempDirPath(path: string): TempDirPath {
  return path as TempDirPath;
}


/**
 * Create a branded EncryptedImagePath
 */
export function asEncryptedImagePath(path: string): EncryptedImagePath {
  return path as EncryptedImagePath;
}

/**
 * Create a branded KeyFilePath
 */
export function asKeyFilePath(path: string): KeyFilePath {
  return path as KeyFilePath;
}

/**
 * Create a branded BundlePath
 */
export function asBundlePath(path: string): BundlePath {
  return path as BundlePath;
}

// ============================================================================
// 🔑 TYPE DEFINITIONS
// ============================================================================

/**
 * 🔑 Encryption parameters for a test
 */
export interface EncryptionParams {
  mode: EncryptionMode;
  key: string;
  iv?: string;
}

/**
 * 🔓 Decryption parameters for a test
 */
export interface DecryptionParams {
  mode: EncryptionMode;
  key: string;
  iv?: string;
}

/**
 * 🔒 Result of encryption operation
 */
export interface EncryptionResult {
  encrypted: Uint8Array;
  original: Uint8Array;
  mode: EncryptionMode;
  metadata: ImageMetadata;
  params: EncryptionParams;
}

/**
 * 🔓 Result of decryption operation
 */
export interface DecryptionResult {
  decrypted: Uint8Array;
  metadata: ImageMetadata;
  mode: EncryptionMode;
}

/**
 * 📦 Extracted bundle contents
 */
export interface ExtractedBundle {
  zip: JSZip;
  encryptedImage: Uint8Array;
  keyData: KeyFileData;
}

/**
 * 🔍 Pixel comparison result
 */
export interface ComparisonResult {
  identical: boolean;
  differenceCount: number;
  totalPixels: number;
}

/**
 * 🔑 Key file data structure
 * Re-exported from crypto.types for convenience
 */
export type { KeyFileData };

/**
 * 📋 Mode test setup options
 */
export interface ModeTestSetupOptions {
  readonly mode: EncryptionMode;
  readonly testImageFile: File;
}

/**
 * 📦 Mode test data returned from setup
 */
export interface ModeTestData {
  readonly tempDir: TempDirPath;
  readonly encryptedImagePath: EncryptedImagePath;
  readonly keyFilePath: KeyFilePath;
  readonly originalImageBits: Uint8Array;
  readonly originalMetadata: ImageMetadata;
  readonly encryptionParams: EncryptionParams;
  readonly mode: EncryptionMode;
}

/**
 * 🔒 Encryption test options
 */
export interface EncryptionTestOptions {
  readonly encryptedImagePath: EncryptedImagePath;
  readonly originalImageBits: Uint8Array;
  readonly mode: EncryptionMode;
}

/**
 * 🔓 Decryption test options
 */
export interface DecryptionTestOptions {
  readonly encryptedImagePath: EncryptedImagePath;
  readonly keyFilePath: KeyFilePath;
  readonly originalImageBits: Uint8Array;
  readonly metadata: ImageMetadata;
}

/**
 * 🔄 Round-trip test options
 */
export interface RoundTripTestOptions {
  readonly encryptedImagePath: EncryptedImagePath;
  readonly keyFilePath: KeyFilePath;
  readonly originalImageBits: Uint8Array;
  readonly metadata: ImageMetadata;
}

/**
 * 📦 Bundle test options
 */
export interface BundleTestOptions {
  readonly tempDir: TempDirPath;
  readonly metadata: ImageMetadata;
  readonly mode: EncryptionMode;
}

/**
 * 🔍 Bit comparison test options
 */
export interface BitComparisonTestOptions {
  readonly encryptedImagePath: EncryptedImagePath;
  readonly keyFilePath: KeyFilePath;
  readonly originalImageBits: Uint8Array;
  readonly metadata: ImageMetadata;
}

/**
 * 🔒 Options for padding round-trip test
 */
export interface PaddingTestOptions {
  readonly originalBits: Uint8Array;
  readonly mode: EncryptionMode;
  readonly expectedPadding?: number;
}

/**
 * 🔒 Options for BMP padding test
 */
export interface BmpPaddingTestOptions extends PaddingTestOptions {
  readonly bmpHeader: Uint8Array;
  readonly bmpBody: Uint8Array;
}

/**
 * 🔒 Options for CTR no-padding test
 */
export interface CtrTestOptions {
  readonly originalBits: Uint8Array;
}