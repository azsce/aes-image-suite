/**
 * Preserve Pattern Encryption Test Execution Helpers
 *
 * Provides execution helpers for preserve pattern (pixel-data) encryption tests.
 * Similar to standardEncryptionExecutions.utils.ts but handles BMP conversion.
 */

// Test Framework - Bun test runner
import { expect } from "bun:test";

// Test-specific BMP Converter
import { convertFileToBmpTest as convertFileToBmp, createBmpBlobTest as createBmpBlob } from "./bmpConverter.utils";

// Application Utilities - Image Comparison
import { compareImageBits } from "../../utils/imageComparison";

import * as TestTypes from "../test.types";
import { createBlobUrl } from "../test.data..utils";
import {
  assertEncryptedDataValid,
  assertDecryptedDataMatches,
  assertImageBitsIdentical,
} from "../test.assert";
import { comparePixelData, loadEncryptedImageAndKey, performDecryption, determineMode } from "../test.operation";

// ============================================================================
// 🧪 TEST EXECUTION HELPERS
// ============================================================================

/**
 * 🧪 Test encryption from disk (BMP pixel-data approach)
 *
 * Loads encrypted BMP from disk and verifies encryption is valid.
 * The encrypted file contains BMP header + encrypted pixel data.
 *
 * @param options - Encryption test options
 */
export async function testBmpEncryptionFromDisk(options: TestTypes.EncryptionTestOptions): Promise<void> {
  const { encryptedImagePath, originalImageBits, mode } = options;

  const encryptedBmpBits = new Uint8Array(await Bun.file(encryptedImagePath).arrayBuffer());

  const BMP_HEADER_SIZE = 54;
  const encryptedBody = encryptedBmpBits.slice(BMP_HEADER_SIZE);

  const originalFile = new File([new Uint8Array(originalImageBits)], "test.png", { type: "image/png" });
  const originalBmpData = await convertFileToBmp(originalFile);
  const originalBody = originalBmpData.body;

  assertEncryptedDataValid(encryptedBody, originalBody, mode);

  const comparison = comparePixelData(encryptedBody, originalBody);
  expect(comparison.identical).toBe(false);

  if (mode === "ECB" || mode === "CBC") {
    expect(encryptedBody.length % 16).toBe(0);
  } else {
    expect(encryptedBody.length).toBe(originalBody.length);
  }
}

/**
 * 🧪 Test decryption from disk (BMP pixel-data approach)
 *
 * Loads encrypted BMP and key from disk, decrypts pixel data, and verifies result.
 *
 * @param options - Decryption test options
 */
export async function testBmpDecryptionFromDisk(options: TestTypes.DecryptionTestOptions): Promise<void> {
  const { encryptedImagePath, keyFilePath, originalImageBits, metadata } = options;

  const mode = determineMode(metadata);

  const { encryptedBmp: encryptedBmpBits, decParams } = await loadEncryptedImageAndKey(
    encryptedImagePath,
    keyFilePath,
    mode
  );

  const BMP_HEADER_SIZE = 54;
  const encryptedBody = encryptedBmpBits.slice(BMP_HEADER_SIZE);

  const decResult = performDecryption(encryptedBody, metadata, decParams);

  const originalFile = new File([new Uint8Array(originalImageBits)], "test.png", { type: "image/png" });
  const originalBmpData = await convertFileToBmp(originalFile);
  const originalBody = originalBmpData.body;

  assertDecryptedDataMatches(decResult.decrypted, originalBody);
}

/**
 * 🧪 Test round-trip from disk (BMP pixel-data approach)
 *
 * Loads encrypted BMP and key from disk, decrypts, and verifies
 * the result is identical to the original pixel data.
 *
 * @param options - Round-trip test options
 */
export async function testBmpRoundTripFromDisk(options: TestTypes.RoundTripTestOptions): Promise<void> {
  const { encryptedImagePath, keyFilePath, originalImageBits, metadata } = options;

  const mode = determineMode(metadata);

  const { encryptedBmp: encryptedBmpBits, decParams } = await loadEncryptedImageAndKey(
    encryptedImagePath,
    keyFilePath,
    mode
  );

  const BMP_HEADER_SIZE = 54;
  const encryptedBody = encryptedBmpBits.slice(BMP_HEADER_SIZE);

  const decResult = performDecryption(encryptedBody, metadata, decParams);

  const originalFile = new File([new Uint8Array(originalImageBits)], "test.png", { type: "image/png" });
  const originalBmpData = await convertFileToBmp(originalFile);
  const originalBody = originalBmpData.body;

  assertImageBitsIdentical(originalBody, decResult.decrypted);
}

/**
 * 🧪 Test bit comparison from disk (BMP pixel-data approach)
 *
 * Loads encrypted BMP and key from disk, decrypts, reconstructs full BMP,
 * and performs bit-level comparison with original.
 *
 * @param options - Bit comparison test options
 */
export async function testBmpBitComparisonFromDisk(options: TestTypes.BitComparisonTestOptions): Promise<void> {
  const { encryptedImagePath, keyFilePath, originalImageBits, metadata } = options;

  const mode = determineMode(metadata);

  const { encryptedBmp: encryptedBmpBits, decParams } = await loadEncryptedImageAndKey(
    encryptedImagePath,
    keyFilePath,
    mode
  );

  const BMP_HEADER_SIZE = 54;
  const bmpHeader = encryptedBmpBits.slice(0, BMP_HEADER_SIZE);
  const encryptedBody = encryptedBmpBits.slice(BMP_HEADER_SIZE);

  const decResult = performDecryption(encryptedBody, metadata, decParams);

  const decryptedBmpBlob = createBmpBlob(bmpHeader, decResult.decrypted);
  const decryptedBmpBits = new Uint8Array(await decryptedBmpBlob.arrayBuffer());

  const originalFile = new File([new Uint8Array(originalImageBits)], "test.png", { type: "image/png" });
  const originalBmpData = await convertFileToBmp(originalFile);

  const originalUrl = createBlobUrl(originalBmpData.fullBmp, "image/bmp");
  const decryptedUrl = createBlobUrl(decryptedBmpBits, "image/bmp");

  try {
    const comparisonResult = await compareImageBits(originalUrl, decryptedUrl);

    expect(comparisonResult.identical).toBe(true);
    expect(comparisonResult.differencePercentage).toBe(0);
    expect(comparisonResult.differenceCount).toBe(0);
    expect(comparisonResult.sizeMismatch).toBe(false);
  } finally {
    URL.revokeObjectURL(originalUrl);
    URL.revokeObjectURL(decryptedUrl);
  }
}
