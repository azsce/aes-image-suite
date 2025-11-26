/**
 * Padding Test Utilities
 *
 * Shared execution helpers and data generation functions for padding integration tests.
 * Follows the pattern of standardEncryptionExecutions.utils.ts to eliminate code duplication.
 */

// TypeScript Types
import type { ImageMetadata } from "../types/crypto.types";

import * as TestTypes from "./test.types";
import { createEncryptionParams } from "./test.data..utils";
import {
  assertEncryptedDataValid,
  assertDecryptedDataMatches,
  assertImageBitsIdentical,
  assertPaddingApplied,
  assertNoPaddingApplied,
  assertExpectedPaddingSize,
} from "./test.assert";
import { performEncryption, performDecryption } from "./test.operation";

// ============================================================================
// 📊 DATA GENERATION
// ============================================================================

/**
 * Calculate data size needed to produce specific padding value
 *
 * PKCS7 Padding Formula:
 * - remainder = dataLength % 16
 * - paddingLength = (remainder === 0) ? 16 : (16 - remainder)
 *
 * To get a specific padding value, we work backwards:
 * - Choose a base size that's a multiple of 16 (e.g., 1024)
 * - Subtract the desired padding value
 *
 * Examples:
 * - calculateSizeForPadding(1) → 1023 bytes (adds 1 byte padding → 1024)
 * - calculateSizeForPadding(8) → 1016 bytes (adds 8 bytes padding → 1024)
 * - calculateSizeForPadding(16) → 1008 bytes (adds 16 bytes padding → 1024)
 *
 * @param paddingValue - Desired padding value (1-16 bytes)
 * @returns Data size that will produce this padding
 */
export function calculateSizeForPadding(paddingValue: number): number {
  const baseSize = 1024;
  return baseSize - paddingValue;
}

/**
 * Generate synthetic data with exact target size
 *
 * Creates deterministic data (not random) for reproducible tests.
 * Uses a repeating pattern: 0, 1, 2, ..., 255, 0, 1, ...
 *
 * @param targetSize - Exact size in bytes
 * @returns Raw bytes with deterministic pattern
 */
export function generateSyntheticData(targetSize: number): Uint8Array {
  const buffer = new Uint8Array(targetSize);

  for (let i = 0; i < targetSize; i++) {
    buffer[i] = i % 256;
  }

  return buffer;
}

/**
 * Create minimal metadata for synthetic data tests
 *
 * Provides just enough metadata to satisfy encryption/decryption functions.
 *
 * @param size - Data size in bytes
 * @returns Minimal image metadata
 */
export function createMinimalMetadata(size: number): ImageMetadata {
  return {
    filename: `synthetic-${String(size)}.dat`,
    mimeType: "application/octet-stream",
    fileSize: size,
    width: 0,
    height: 0,
  };
}

/**
 * Create synthetic BMP data with controlled body size
 *
 * Generates a minimal BMP header (54 bytes) and synthetic body data.
 * The body size is controlled to produce specific padding values.
 *
 * @param bodySize - Desired body size in bytes
 * @returns Object with header and body
 */
export function createSyntheticBmpData(bodySize: number): { header: Uint8Array; body: Uint8Array } {
  const header = new Uint8Array(54);
  header[0] = 0x42;
  header[1] = 0x4d;

  const body = generateSyntheticData(bodySize);

  return { header, body };
}

// ============================================================================
// 🧪 EXECUTION HELPERS
// ============================================================================

/**
 * Core padding test logic shared by all test functions
 *
 * @param originalBits - Original data to encrypt
 * @param mode - Encryption mode
 * @param expectedPadding - Expected padding size (optional)
 */
function executePaddingTest(originalBits: Uint8Array, mode: TestTypes.EncryptionParams["mode"], expectedPadding?: number): void {
  const params = createEncryptionParams(mode);
  const metadata = createMinimalMetadata(originalBits.length);
  const encResult = performEncryption(originalBits, metadata, params);

  assertEncryptedDataValid(encResult.encrypted, originalBits, mode);

  if (mode === "ECB" || mode === "CBC") {
    assertPaddingApplied(encResult.encrypted, originalBits);
    if (expectedPadding !== undefined) {
      assertExpectedPaddingSize(encResult.encrypted, originalBits, expectedPadding);
    }
  } else {
    assertNoPaddingApplied(encResult.encrypted, originalBits);
  }

  const decParams: TestTypes.DecryptionParams = {
    mode,
    key: params.key,
    iv: params.iv,
  };
  const decResult = performDecryption(encResult.encrypted, metadata, decParams);

  assertDecryptedDataMatches(decResult.decrypted, originalBits);
  assertImageBitsIdentical(originalBits, decResult.decrypted);
}

/**
 * Test padding round-trip for whole-file encryption
 *
 * Encapsulates ALL test logic for standard encryption padding tests.
 * Test files just call this function with appropriate options.
 *
 * @param options - Padding test options
 */
export function testPaddingRoundTrip(options: TestTypes.PaddingTestOptions): void {
  const { originalBits, mode, expectedPadding } = options;
  executePaddingTest(originalBits, mode, expectedPadding);
}

/**
 * Test padding round-trip for BMP pixel-data encryption
 *
 * Encapsulates ALL test logic for BMP padding tests.
 * Similar to testPaddingRoundTrip but works with BMP header/body split.
 *
 * @param options - BMP padding test options
 */
export function testBmpPaddingRoundTrip(options: TestTypes.BmpPaddingTestOptions): void {
  const { bmpBody, mode, expectedPadding } = options;
  executePaddingTest(bmpBody, mode, expectedPadding);
}

/**
 * Test CTR mode has no padding
 *
 * Verifies that CTR mode (stream cipher) doesn't add padding.
 * Encrypted size must exactly match original size.
 *
 * @param options - CTR test options
 */
export function testCtrNoPadding(options: TestTypes.CtrTestOptions): void {
  const { originalBits } = options;

  const params = createEncryptionParams("CTR");
  const metadata = createMinimalMetadata(originalBits.length);
  const encResult = performEncryption(originalBits, metadata, params);

  assertNoPaddingApplied(encResult.encrypted, originalBits);

  const decParams: TestTypes.DecryptionParams = {
    mode: "CTR",
    key: params.key,
    iv: params.iv,
  };
  const decResult = performDecryption(encResult.encrypted, metadata, decParams);

  assertDecryptedDataMatches(decResult.decrypted, originalBits);
  assertImageBitsIdentical(originalBits, decResult.decrypted);
}
