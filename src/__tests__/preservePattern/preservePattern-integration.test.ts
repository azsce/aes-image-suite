/**
 * AES Image Encryption Suite - Preserve Pattern Integration Tests
 *
 * This test suite provides comprehensive integration tests for preserve pattern encryption.
 * Preserve pattern encryption converts images to BMP format and encrypts only the pixel data,
 * keeping the BMP header intact. This allows encrypted images to be viewable (showing patterns).
 *
 * Test Coverage:
 * - ECB Mode: Encryption, Decryption, Round-trip, Bit comparison
 * - CBC Mode: Encryption, Decryption, Round-trip, Bit comparison
 * - CTR Mode: Encryption, Decryption, Round-trip, Bit comparison
 */

// ============================================================================
// 📦 IMPORTS
// ============================================================================

import "../setupt";

// Test Framework - Bun test runner
import { describe, it, beforeAll, afterAll } from "bun:test";

// Test-specific BMP Converter
import { convertFileToBmpTest as convertFileToBmp, createBmpBlobTest as createBmpBlob } from "./bmpConverter.utils";

// TypeScript Types
import type { EncryptionMode, ImageMetadata } from "../../types/crypto.types";

import * as TestTypes from "../test.types";
import { createEncryptionParams, readImageFile } from "../test.data..utils";
import { performEncryption } from "../test.operation";
import {
  testBmpEncryptionFromDisk,
  testBmpDecryptionFromDisk,
  testBmpRoundTripFromDisk,
  testBmpBitComparisonFromDisk,
} from "./preservePatternExecutions.utils";
import { discoverImageFiles, assertImageFilesExist } from "../imageDiscovery.utils";
import { generateBinaryKeyFile } from "../../utils/keyFileHandler";
import { hexToBytes } from "../../utils/hexUtils";

// ============================================================================
// 🧪 MODE SETUP & CLEANUP HELPERS
// ============================================================================

/**
 * 🧪 Run encryption test for all images in test data map
 */
async function runBmpEncryptionTest(
  testDataMap: Map<string, TestTypes.ModeTestData>,
  mode: EncryptionMode
): Promise<void> {
  for (const testData of testDataMap.values()) {
    await testBmpEncryptionFromDisk({
      encryptedImagePath: testData.encryptedImagePath,
      originalImageBits: testData.originalImageBits,
      mode,
    });
  }
}

/**
 * 🧪 Helper to create metadata with mode
 */
function createMetadataWithMode(testData: TestTypes.ModeTestData): ImageMetadata {
  return { ...testData.originalMetadata, mode: testData.mode } as ImageMetadata & { mode: EncryptionMode };
}

/**
 * 🧪 Run test operation for all images in test data map
 */
async function runTestForAllImages(
  testDataMap: Map<string, TestTypes.ModeTestData>,
  testFn: (testData: TestTypes.ModeTestData) => Promise<void>
): Promise<void> {
  for (const testData of testDataMap.values()) {
    await testFn(testData);
  }
}

/**
 * 🧪 Create standard test parameters from test data
 */
function createStandardTestParams(testData: TestTypes.ModeTestData) {
  return {
    encryptedImagePath: testData.encryptedImagePath,
    keyFilePath: testData.keyFilePath,
    originalImageBits: testData.originalImageBits,
    metadata: createMetadataWithMode(testData),
  };
}

/**
 * 🧪 Run decryption test for all images in test data map
 */
async function runBmpDecryptionTest(testDataMap: Map<string, TestTypes.ModeTestData>): Promise<void> {
  await runTestForAllImages(testDataMap, async testData => {
    await testBmpDecryptionFromDisk(createStandardTestParams(testData));
  });
}

/**
 * 🧪 Run round-trip test for all images in test data map
 */
async function runBmpRoundTripTest(testDataMap: Map<string, TestTypes.ModeTestData>): Promise<void> {
  await runTestForAllImages(testDataMap, async testData => {
    await testBmpRoundTripFromDisk(createStandardTestParams(testData));
  });
}

/**
 * 🧪 Run bit comparison test for all images in test data map
 */
async function runBmpBitComparisonTest(testDataMap: Map<string, TestTypes.ModeTestData>): Promise<void> {
  await runTestForAllImages(testDataMap, async testData => {
    await testBmpBitComparisonFromDisk(createStandardTestParams(testData));
  });
}

/**
 * 🧪 Setup test data for preserve pattern encryption
 *
 * Converts image to BMP, encrypts pixel data only, saves encrypted BMP and key.
 *
 * @param options - Setup options containing mode and test image file
 * @returns Test data for the mode
 */
async function setupBmpModeTests(options: TestTypes.ModeTestSetupOptions): Promise<TestTypes.ModeTestData> {
  const { mode, testImageFile } = options;

  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  const randomSuffix = Array.from(randomBytes)
    .map(b => b.toString(36))
    .join("");
  const tempDir = TestTypes.asTempDirPath(
    `/tmp/aes-bmp-test-${mode.toLowerCase()}-${String(Date.now())}-${randomSuffix}`
  );
  await Bun.write(`${tempDir}/.keep`, "");

  const originalImageBits = await readImageFile(testImageFile);
  const originalMetadata = await extractImageMetadataForTest(testImageFile);

  const bmpData = await convertFileToBmp(testImageFile);

  const encryptionParams = createEncryptionParams(mode);
  const encResult = performEncryption(bmpData.body, originalMetadata, encryptionParams);

  const encryptedBmpBlob = createBmpBlob(bmpData.header, encResult.encrypted);
  const encryptedBmpBits = new Uint8Array(await encryptedBmpBlob.arrayBuffer());

  const encryptedImagePath = TestTypes.asEncryptedImagePath(`${tempDir}/encrypted-image.bmp`);
  await Bun.write(encryptedImagePath, encryptedBmpBits);

  const keyBytes = hexToBytes(encryptionParams.key);
  const ivBytes = encryptionParams.iv ? hexToBytes(encryptionParams.iv) : undefined;
  const keyFileBits = generateBinaryKeyFile(keyBytes, mode, ivBytes);
  const keyFilePath = TestTypes.asKeyFilePath(`${tempDir}/encryption-key`);
  await Bun.write(keyFilePath, keyFileBits);

  return {
    tempDir,
    encryptedImagePath,
    keyFilePath,
    originalImageBits,
    originalMetadata,
    encryptionParams,
    mode,
  };
}

/**
 * 🧪 Cleanup test data for a mode
 */
async function cleanupBmpModeTests(tempDir: TestTypes.TempDirPath): Promise<void> {
  await Bun.$`rm -rf ${tempDir}`.quiet();
}

// ============================================================================
// 🧪 TEST SUITES
// ============================================================================

describe("AES Image Encryption Suite - Preserve Pattern Integration Tests", () => {
  let testImageFiles: File[] = [];

  beforeAll(async () => {
    const imagesDir = new URL("../images", import.meta.url).pathname;
    const imagePaths = discoverImageFiles(imagesDir);

    assertImageFilesExist(imagePaths);

    for (const imagePath of imagePaths) {
      const file = Bun.file(imagePath);

      if (await file.exists()) {
        const arrayBuffer = await file.arrayBuffer();
        const fileName = imagePath.split("/").pop() || "unknown.png";
        const mimeType = getMimeTypeFromExtension(fileName);

        testImageFiles.push(new File([arrayBuffer], fileName, { type: mimeType }));
      }
    }
  });

  afterAll(() => {
    testImageFiles = [];
  });

  /**
   * 🧪 Create test suite for a specific encryption mode (BMP pixel-data approach)
   */
  function createBmpModeTestSuite(mode: EncryptionMode): void {
    describe(`${mode} Mode (Pixel Data)`, () => {
      const testDataMap = new Map<string, TestTypes.ModeTestData>();

      beforeAll(async () => {
        for (const testImageFile of testImageFiles) {
          const testData = await setupBmpModeTests({ mode, testImageFile });
          testDataMap.set(testImageFile.name, testData);
        }
      });

      afterAll(async () => {
        for (const testData of testDataMap.values()) {
          await cleanupBmpModeTests(testData.tempDir);
        }
        testDataMap.clear();
      });

      it("should encrypt BMP pixel data correctly", async () => {
        await runBmpEncryptionTest(testDataMap, mode);
      });

      it("should decrypt BMP pixel data correctly", async () => {
        await runBmpDecryptionTest(testDataMap);
      });

      it("should produce identical pixel data after round-trip", async () => {
        await runBmpRoundTripTest(testDataMap);
      });

      it("should produce 100% identical BMP after decryption (bit comparison)", async () => {
        await runBmpBitComparisonTest(testDataMap);
      });
    });
  }

  createBmpModeTestSuite("ECB");
  createBmpModeTestSuite("CBC");
  createBmpModeTestSuite("CTR");
});

/**
 * 🏗️ Extract image metadata (test-specific implementation)
 *
 * Extracts metadata from image file using node-canvas directly.
 * This avoids blob URL issues in test environment.
 */
async function extractImageMetadataForTest(file: File): Promise<ImageMetadata> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  interface CanvasImageConstructor {
    new(): {
      src: Buffer;
      width: number;
      height: number;
    };
  }

  const ImageConstructor = globalThis.Image as unknown as CanvasImageConstructor;
  const img = new ImageConstructor();
  img.src = buffer;

  return {
    width: img.width,
    height: img.height,
    mimeType: file.type,
    filename: file.name,
    fileSize: file.size,
  };
}

/**
 * Get MIME type from file extension
 */
function getMimeTypeFromExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp",
    tiff: "image/tiff",
    tif: "image/tiff",
  };

  return mimeTypes[ext || ""] || "application/octet-stream";
}
