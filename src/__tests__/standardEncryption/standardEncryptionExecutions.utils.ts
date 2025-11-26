// Test Framework - Bun test runner
import {  expect} from "bun:test";

// Application Utilities - JSZip
import JSZip from "jszip";

// Application Utilities - Image Comparison
import { compareImageBits } from "../../utils/imageComparison";

import * as TestTypes from "../test.types";
import { createBlobUrl} from "../test.data..utils";
import { assertBundleContainsFiles, assertDecryptedDataMatches, assertEncryptedDataValid, assertImageBitsIdentical, assertKeyFileValid } from "../test.assert";
import { comparePixelData, determineMode, extractBundle, loadEncryptedImageAndKey, performDecryption } from "../test.operation";


// ============================================================================
// 🧪 TEST EXECUTION HELPERS
// ============================================================================

/**
 * 🧪 Test encryption from disk
 *
 * Loads encrypted image from disk and verifies encryption is valid.
 *
 * @param options - Encryption test options
 */
export async function testEncryptionFromDisk(options: TestTypes.EncryptionTestOptions): Promise<void> {
  const { encryptedImagePath, originalImageBits, mode } = options;

  // Load encrypted image from disk
  const encryptedBits = new Uint8Array(await Bun.file(encryptedImagePath).arrayBuffer());

  // Verify encrypted data is valid
  assertEncryptedDataValid(encryptedBits, originalImageBits, mode);

  // Verify encrypted data differs from original
  const comparison = comparePixelData(encryptedBits, originalImageBits);
  expect(comparison.identical).toBe(false);

  // Verify encrypted length based on mode
  if (mode === "ECB" || mode === "CBC") {
    expect(encryptedBits.length % 16).toBe(0);
  } else {
    expect(encryptedBits.length).toBe(originalImageBits.length);
  }
}

/**
 * 🧪 Test decryption from disk
 *
 * Loads encrypted image and key from disk, decrypts, and verifies result.
 *
 * @param options - Decryption test options
 */
export async function testDecryptionFromDisk(options: TestTypes.DecryptionTestOptions): Promise<void> {
  const { encryptedImagePath, keyFilePath, originalImageBits, metadata } = options;

  // Determine mode from metadata (stored in test data)
  const mode = determineMode(metadata);

  // Load encrypted image and key from disk
  const { encryptedBmp: encryptedBits, decParams } = await loadEncryptedImageAndKey(
    encryptedImagePath,
    keyFilePath,
    mode
  );

  // Perform decryption
  const decResult = performDecryption(encryptedBits, metadata, decParams);

  // Verify decrypted data matches original byte-by-byte
  assertDecryptedDataMatches(decResult.decrypted, originalImageBits);
}

/**
 * 🧪 Test round-trip from disk
 *
 * Loads encrypted image and key from disk, decrypts, and verifies
 * the result is identical to the original.
 *
 * @param options - Round-trip test options
 */
export async function testRoundTripFromDisk(options: TestTypes.RoundTripTestOptions): Promise<void> {
  const { encryptedImagePath, keyFilePath, originalImageBits, metadata } = options;

  // Determine mode from metadata (stored in test data)
  const mode = determineMode(metadata);

  // Load encrypted image and key from disk
  const { encryptedBmp: encryptedBits, decParams } = await loadEncryptedImageAndKey(
    encryptedImagePath,
    keyFilePath,
    mode
  );

  // Perform decryption
  const decResult = performDecryption(encryptedBits, metadata, decParams);

  // Verify encrypt then decrypt produces identical result
  assertImageBitsIdentical(originalImageBits, decResult.decrypted);
}

/**
 * 🧪 Test bundle from disk
 *
 * Loads bundle from disk, extracts contents, and verifies structure.
 *
 * @param options - Bundle test options
 */
export async function testBundleFromDisk(options: TestTypes.BundleTestOptions): Promise<void> {
  const { tempDir, metadata, mode } = options;

  // Load bundle from disk (safe: test-generated bundle in controlled environment)
  const bundlePath = TestTypes.asBundlePath(`${tempDir}/test-bundle.zip`);
  const bundleBuffer = await Bun.file(bundlePath).arrayBuffer();
  // eslint-disable-next-line sonarjs/no-unsafe-unzip
  const bundle = await JSZip.loadAsync(bundleBuffer);

  // Extract and verify bundle contents
  const extracted = await extractBundle(bundle);

  // Verify bundle contains encrypted image (.enc) and binary key file
  const originalName = metadata.filename.replace(/\.[^/.]+$/, "");
  assertBundleContainsFiles(extracted.zip, [`encrypted-${originalName}.enc`, "encryption-key"]);

  // Verify key file has correct mode and IV
  assertKeyFileValid(extracted.keyData, mode);
}

/**
 * 🧪 Test bit comparison from disk
 *
 * Loads encrypted image and key from disk, decrypts, and performs
 * bit-level comparison with original.
 *
 * @param options - Bit comparison test options
 */
export async function testBitComparisonFromDisk(options: TestTypes.BitComparisonTestOptions): Promise<void> {
  const { encryptedImagePath, keyFilePath, originalImageBits, metadata } = options;

  // Determine mode from metadata (stored in test data)
  const mode = determineMode(metadata);

  // Load encrypted image and key from disk
  const { encryptedBmp: encryptedBits, decParams } = await loadEncryptedImageAndKey(
    encryptedImagePath,
    keyFilePath,
    mode
  );

  // Perform decryption
  const decResult = performDecryption(encryptedBits, metadata, decParams);

  // Create blob URLs for image comparison
  const originalUrl = createBlobUrl(originalImageBits, metadata.mimeType);
  const decryptedUrl = createBlobUrl(decResult.decrypted, metadata.mimeType);

  try {
    // Compare images using the bit-level comparison utility
    const comparisonResult = await compareImageBits(originalUrl, decryptedUrl);

    // Verify images are 100% identical
    expect(comparisonResult.identical).toBe(true);
    expect(comparisonResult.differencePercentage).toBe(0);
    expect(comparisonResult.differenceCount).toBe(0);
    expect(comparisonResult.sizeMismatch).toBe(false);
  } finally {
    // Cleanup blob URLs
    URL.revokeObjectURL(originalUrl);
    URL.revokeObjectURL(decryptedUrl);
  }
}