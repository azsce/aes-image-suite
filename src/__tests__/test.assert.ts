// Application Utilities - JSZip
import JSZip from "jszip";

// TypeScript Types
import type { EncryptionMode } from "../types/crypto.types";

import * as TestTypes from "./test.types";
import { comparePixelData } from "./test.operation";

// ============================================================================
// ✅ ASSERTION HELPERS
// ============================================================================

/**
 * ✅ Assert encrypted data size is valid for the mode
 *
 * Verifies that encrypted data length follows mode-specific rules:
 * - ECB/CBC: Length must be multiple of 16 (block size)
 * - CTR: Length matches original (stream cipher)
 *
 * @param encrypted - 🔒 Encrypted data
 * @param original - 📄 Original data
 * @param mode - 🔀 Encryption mode
 * @throws {Error} If size validation fails
 */
function assertEncryptedSize(encrypted: Uint8Array, original: Uint8Array, mode: EncryptionMode): void {
  const isBlockCipherMode = mode === "ECB" || mode === "CBC";

  if (isBlockCipherMode) {
    assertBlockCipherSize(encrypted, mode);
  } else {
    assertStreamCipherSize(encrypted, original);
  }
}

/**
 * ✅ Assert block cipher encrypted data size
 */
function assertBlockCipherSize(encrypted: Uint8Array, mode: EncryptionMode): void {
  if (encrypted.length % 16 !== 0) {
    throw new Error(`${mode} encrypted data length (${String(encrypted.length)}) must be multiple of 16`);
  }
}

/**
 * ✅ Assert stream cipher encrypted data size
 */
function assertStreamCipherSize(encrypted: Uint8Array, original: Uint8Array): void {
  if (encrypted.length !== original.length) {
    throw new Error(
      `CTR encrypted data length (${String(encrypted.length)}) must match original (${String(original.length)})`
    );
  }
}

/**
 * ✅ Assert encrypted data is valid
 *
 * Verifies that:
 * - Encrypted data has non-zero length
 * - Encrypted data differs from original
 * - Size follows mode-specific rules
 *
 * @param encrypted - 🔒 Encrypted data
 * @param original - 📄 Original data
 * @param mode - 🔀 Encryption mode
 * @throws {Error} If validation fails
 */
export function assertEncryptedDataValid(encrypted: Uint8Array, original: Uint8Array, mode: EncryptionMode): void {
  if (encrypted.length === 0) {
    throw new Error("Encrypted data has zero length");
  }

  const comparison = comparePixelData(encrypted, original);
  if (comparison.identical) {
    throw new Error("Encrypted data is identical to original (encryption failed)");
  }

  assertEncryptedSize(encrypted, original, mode);
}

/**
 * ✅ Assert decrypted data matches original
 *
 * Verifies that:
 * - Decrypted length matches original length
 * - Decrypted data equals original byte-by-byte
 *
 * @param decrypted - 🔓 Decrypted data
 * @param original - 📄 Original data
 * @throws {Error} If validation fails
 */
export function assertDecryptedDataMatches(decrypted: Uint8Array, original: Uint8Array): void {
  if (decrypted.length !== original.length) {
    throw new Error(
      `Decrypted length (${String(decrypted.length)}) does not match original (${String(original.length)})`
    );
  }

  const comparison = comparePixelData(decrypted, original);
  if (!comparison.identical) {
    throw new Error(`Decrypted data differs from original at ${String(comparison.differenceCount)} bytes`);
  }
}

/**
 * ✅ Assert image bits are identical
 *
 * Verifies that two image bit arrays are byte-for-byte identical.
 *
 * @param bits1 - 📦 First image bits
 * @param bits2 - 📦 Second image bits
 * @throws {Error} If validation fails
 */
export function assertImageBitsIdentical(bits1: Uint8Array, bits2: Uint8Array): void {
  const comparison = comparePixelData(bits1, bits2);
  if (!comparison.identical) {
    throw new Error(
      `Image bits differ at ${String(comparison.differenceCount)} bytes out of ${String(comparison.totalPixels)}`
    );
  }
}

/**
 * ✅ Assert bundle contains expected files
 *
 * Verifies that:
 * - Each expected file pattern exists in zip
 * - File count matches expected count
 *
 * @param zip - 📦 ZIP bundle
 * @param expectedPatterns - 📋 Array of expected file patterns (e.g., "*.png", "*.json")
 * @throws {Error} If validation fails
 */
export function assertBundleContainsFiles(zip: JSZip, expectedPatterns: string[]): void {
  const files = zip.files;
  const fileNames = Object.keys(files);

  if (fileNames.length !== expectedPatterns.length) {
    throw new Error(`Bundle contains ${String(fileNames.length)} files, expected ${String(expectedPatterns.length)}`);
  }

  for (const pattern of expectedPatterns) {
    const regex = new RegExp(pattern.replace("*", ".*"));
    const found = fileNames.some(name => regex.test(name));
    if (!found) {
      throw new Error(`Bundle missing file matching pattern: ${pattern}`);
    }
  }
}

/**
 * ✅ Validate binary key size
 */
function validateKeySize(key: Uint8Array): void {
  const validSizes = [16, 24, 32];
  if (!validSizes.includes(key.length)) {
    throw new Error(
      `Key size is ${String(key.length)} bytes (${String(key.length * 8)} bits), expected 16, 24, or 32 bytes (128, 192, or 256 bits)`
    );
  }
}

/**
 * ✅ Validate binary IV size
 */
function validateIVSize(iv: Uint8Array): void {
  if (iv.length !== 16) {
    throw new Error(`IV size is ${String(iv.length)} bytes (${String(iv.length * 8)} bits), expected 16 bytes (128 bits)`);
  }
}

/**
 * ✅ Validate IV based on encryption mode
 */
function validateIV(keyData: TestTypes.KeyFileData, mode: EncryptionMode): void {
  if (mode === "ECB") {
    assertNoIVForECB(keyData);
  } else {
    assertIVExists(keyData, mode);
    if (keyData.iv) {
      validateIVSize(keyData.iv);
    }
  }
}

/**
 * ✅ Assert ECB mode has no IV
 */
function assertNoIVForECB(keyData: TestTypes.KeyFileData): void {
  if (keyData.iv !== undefined) {
    throw new Error("ECB mode should not have IV in key file");
  }
}

/**
 * ✅ Assert IV exists for non-ECB modes
 */
function assertIVExists(keyData: TestTypes.KeyFileData, mode: EncryptionMode): void {
  if (!keyData.iv) {
    throw new Error(`${mode} mode requires IV in key file`);
  }
}

/**
 * ✅ Assert key file data is valid
 *
 * Verifies that:
 * - Key exists and has valid size (16, 24, or 32 bytes)
 * - IV exists for CBC/CTR, absent for ECB
 * - IV has valid size (16 bytes) if present
 *
 * @param keyData - 🔑 Key file data (binary format with Uint8Array)
 * @param expectedMode - 🔀 Expected encryption mode
 * @throws {Error} If validation fails
 */
export function assertKeyFileValid(keyData: TestTypes.KeyFileData, expectedMode: EncryptionMode): void {
  assertKeyExists(keyData);
  validateIV(keyData, expectedMode);
}

/**
 * ✅ Assert key exists and has valid size
 */
function assertKeyExists(keyData: TestTypes.KeyFileData): void {
  if (keyData.key.length === 0) {
    throw new Error("Key file has empty key");
  }
  validateKeySize(keyData.key);
}

/**
 * ✅ Assert padding was applied correctly
 *
 * Verifies that:
 * - Encrypted data is larger than original (padding added)
 * - Encrypted data length is multiple of 16 (block size)
 *
 * @param encrypted - 🔒 Encrypted data
 * @param original - 📄 Original data
 * @throws {Error} If padding validation fails
 */
export function assertPaddingApplied(encrypted: Uint8Array, original: Uint8Array): void {
  if (encrypted.length <= original.length) {
    throw new Error(
      `Padding not applied: encrypted (${String(encrypted.length)}) <= original (${String(original.length)})`
    );
  }
  if (encrypted.length % 16 !== 0) {
    throw new Error(`Invalid padding: encrypted length (${String(encrypted.length)}) not multiple of 16`);
  }
}

/**
 * ✅ Assert no padding was applied (CTR mode)
 *
 * Verifies that encrypted and original data have identical lengths.
 *
 * @param encrypted - 🔒 Encrypted data
 * @param original - 📄 Original data
 * @throws {Error} If sizes don't match
 */
export function assertNoPaddingApplied(encrypted: Uint8Array, original: Uint8Array): void {
  if (encrypted.length !== original.length) {
    throw new Error(
      `Unexpected padding: encrypted (${String(encrypted.length)}) != original (${String(original.length)})`
    );
  }
}

/**
 * ✅ Assert exact padding size matches expected
 *
 * Verifies that the difference between encrypted and original
 * data lengths matches the expected padding value.
 *
 * @param encrypted - 🔒 Encrypted data
 * @param original - 📄 Original data
 * @param expectedPadding - 📏 Expected padding size (1-16 bytes)
 * @throws {Error} If padding size doesn't match
 */
export function assertExpectedPaddingSize(
  encrypted: Uint8Array,
  original: Uint8Array,
  expectedPadding: number
): void {
  const actualPadding = encrypted.length - original.length;
  if (actualPadding !== expectedPadding) {
    throw new Error(`Wrong padding: expected ${String(expectedPadding)} bytes, got ${String(actualPadding)} bytes`);
  }
}
