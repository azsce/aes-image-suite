/**
 * AES Image Encryption Suite - Integration Tests
 *
 * This test suite provides comprehensive integration tests for the AES Image Encryption Suite.
 * It verifies the correctness of encryption, decryption, and image processing functionality
 * across all three supported AES modes (ECB, CBC, CTR).
 *
 * The tests simulate real application workflows without using Web Workers, calling encryption
 * and decryption functions directly. All tests use a consistent reference image and follow
 * a zero-duplication design through extensive use of helper functions.
 *
 * Test Coverage:
 * - ECB Mode: Encryption, Decryption, Round-trip, Bundle workflow, Bit comparison
 * - CBC Mode: Encryption, Decryption, Round-trip, Bundle workflow, Bit comparison
 * - CTR Mode: Encryption, Decryption, Round-trip, Bundle workflow, Bit comparison
 */

// ============================================================================
// 📦 IMPORTS
// ============================================================================

import "../setupt"

// Test Framework - Bun test runner
import { describe, it, beforeAll, afterAll } from "bun:test";

// Application Utilities - JSZip
import JSZip from "jszip";

// TypeScript Types
import type { EncryptionMode, ImageMetadata } from "../../types/crypto.types";

import * as TestTypes from "../test.types";
import {  createEncryptionParams, createTestBundle, readImageFile } from "../test.data..utils";
import { performEncryption } from "../test.operation";
import { testBitComparisonFromDisk, testBundleFromDisk, testDecryptionFromDisk, testEncryptionFromDisk, testRoundTripFromDisk } from "./standardEncryptionExecutions.utils";
import { discoverImageFiles, assertImageFilesExist } from "../imageDiscovery.utils";


// ============================================================================
// 🧪 MODE SETUP & CLEANUP HELPERS
// ============================================================================

/**
 * 🧪 Run encryption test for all images in test data map
 */
async function runEncryptionTest(testDataMap: Map<string, TestTypes.ModeTestData>, mode: EncryptionMode): Promise<void> {
  for (const testData of testDataMap.values()) {
    await testEncryptionFromDisk({
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
 * 
 * Generic helper that iterates over test data and executes the provided test function.
 * This eliminates duplication across different test types.
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
 * 
 * Builds the common parameter object used by decryption, round-trip, and bit comparison tests.
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
async function runDecryptionTest(testDataMap: Map<string, TestTypes.ModeTestData>): Promise<void> {
  await runTestForAllImages(testDataMap, async (testData) => {
    await testDecryptionFromDisk(createStandardTestParams(testData));
  });
}

/**
 * 🧪 Run round-trip test for all images in test data map
 */
async function runRoundTripTest(testDataMap: Map<string, TestTypes.ModeTestData>): Promise<void> {
  await runTestForAllImages(testDataMap, async (testData) => {
    await testRoundTripFromDisk(createStandardTestParams(testData));
  });
}

/**
 * 🧪 Run bundle test for all images in test data map
 */
async function runBundleTest(testDataMap: Map<string, TestTypes.ModeTestData>, mode: EncryptionMode): Promise<void> {
  await runTestForAllImages(testDataMap, async (testData) => {
    await testBundleFromDisk({
      tempDir: testData.tempDir,
      metadata: testData.originalMetadata,
      mode,
    });
  });
}

/**
 * 🧪 Run bit comparison test for all images in test data map
 */
async function runBitComparisonTest(testDataMap: Map<string, TestTypes.ModeTestData>): Promise<void> {
  await runTestForAllImages(testDataMap, async (testData) => {
    await testBitComparisonFromDisk(createStandardTestParams(testData));
  });
}

/**
 * 🧪 Setup test data for a specific encryption mode
 *
 * Creates temporary directory, encrypts test image, creates bundle,
 * and saves all files to disk for testing.
 * Note: Uses crypto.getRandomValues() for secure random number generation in temp directory names.
 *
 * @param options - Setup options containing mode and test image file
 * @returns {Promise<ModeTestData>} Test data for the mode
 */
async function setupModeTests(options: TestTypes.ModeTestSetupOptions): Promise<TestTypes.ModeTestData> {
  const { mode, testImageFile } = options;

  // Create temp directory with secure random suffix
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  const randomSuffix = Array.from(randomBytes)
    .map(b => b.toString(36))
    .join("");
  const tempDir = TestTypes.asTempDirPath(`/tmp/aes-test-${mode.toLowerCase()}-${String(Date.now())}-${randomSuffix}`);
  await Bun.write(`${tempDir}/.keep`, "");

  // Read original image bits and metadata
  const originalImageBits = await readImageFile(testImageFile);
  const originalMetadata = await extractImageMetadataForTest(testImageFile);

  // Create encryption parameters and perform encryption
  const encryptionParams = createEncryptionParams(mode);
  const encResult = performEncryption(originalImageBits, originalMetadata, encryptionParams);

  // Create bundle with encrypted image and key
  const bundle = createTestBundle(encResult.encrypted, encryptionParams, originalMetadata);

  // Save bundle to disk (note: this extracts a test-generated bundle in a controlled environment)
  const bundleBuffer = await bundle.generateAsync({ type: "nodebuffer" });
  const bundlePath = TestTypes.asBundlePath(`${tempDir}/test-bundle.zip`);
  await Bun.write(bundlePath, bundleBuffer);

  // Extract files from bundle (safe: test-generated bundle in controlled environment)
  // eslint-disable-next-line sonarjs/no-unsafe-unzip
  const savedBundle = await JSZip.loadAsync(bundleBuffer);
  const files = savedBundle.files;

  // Save encrypted image (.enc file)
  const imageFileName = Object.keys(files).find(name => name.toLowerCase().endsWith(".enc"));

  let encryptedImagePath: TestTypes.EncryptedImagePath;
  if (imageFileName) {
    const imageData = await files[imageFileName].async("nodebuffer");
    encryptedImagePath = TestTypes.asEncryptedImagePath(`${tempDir}/encrypted-image.enc`);
    await Bun.write(encryptedImagePath, new Uint8Array(imageData));
  } else {
    throw new Error("No .enc file found in bundle");
  }

  // Save binary key file (no extension)
  const keyFileName = Object.keys(files).find(name => name.includes("encryption-key") && !name.includes("."));
  let keyFilePath: TestTypes.KeyFilePath;
  if (keyFileName) {
    const keyData = await files[keyFileName].async("nodebuffer");
    keyFilePath = TestTypes.asKeyFilePath(`${tempDir}/encryption-key`);
    await Bun.write(keyFilePath, new Uint8Array(keyData));
  } else {
    throw new Error("No binary key file found in bundle");
  }

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
 *
 * Removes temporary directory and all files.
 *
 * @param tempDir - Temporary directory path to remove
 */
async function cleanupModeTests(tempDir: TestTypes.TempDirPath): Promise<void> {
  await Bun.$`rm -rf ${tempDir}`.quiet();
}


// ============================================================================
// 🧪 TEST SUITES
// ============================================================================

describe("AES Image Encryption Suite - Integration Tests", () => {
  // Shared test data - loaded once and reused across all tests
  let testImageFiles: File[] = [];

  /**
   * Load test images before all tests execute
   * Discovers all image files recursively from test images directory
   */
  beforeAll(async () => {
    // Discover all image files in test directory
    const imagesDir = new URL("../images", import.meta.url).pathname;
    const imagePaths = discoverImageFiles(imagesDir);
    
    // Assert at least one valid image file exists
    assertImageFilesExist(imagePaths);

    // Load all discovered images as File objects
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

  /**
   * Cleanup after all tests complete
   * Releases any resources or object URLs created during testing
   */
  afterAll(() => {
    // Clear test image references to allow garbage collection
    testImageFiles = [];
  });

  /**
   * 🧪 Create test suite for a specific encryption mode
   * 
   * Generates a complete test suite with setup, teardown, and all test cases
   * for the specified encryption mode. This eliminates code duplication across
   * ECB, CBC, and CTR mode test suites.
   * 
   * @param mode - Encryption mode to test (ECB, CBC, or CTR)
   */
  function createModeTestSuite(mode: EncryptionMode): void {
    describe(`${mode} Mode`, () => {
      const testDataMap = new Map<string, TestTypes.ModeTestData>();

      beforeAll(async () => {
        for (const testImageFile of testImageFiles) {
          const testData = await setupModeTests({ mode, testImageFile });
          testDataMap.set(testImageFile.name, testData);
        }
      });

      afterAll(async () => {
        for (const testData of testDataMap.values()) {
          await cleanupModeTests(testData.tempDir);
        }
        testDataMap.clear();
      });

      it("should encrypt image correctly", async () => {
        await runEncryptionTest(testDataMap, mode);
      });

      it("should decrypt image correctly", async () => {
        await runDecryptionTest(testDataMap);
      });

      it("should produce identical image after round-trip", async () => {
        await runRoundTripTest(testDataMap);
      });

      it("should create and extract bundle correctly", async () => {
        await runBundleTest(testDataMap, mode);
      });

      it("should produce 100% identical image after decryption (bit comparison)", async () => {
        await runBitComparisonTest(testDataMap);
      });
    });
  }

  // Generate test suites for all encryption modes
  createModeTestSuite("ECB");
  createModeTestSuite("CBC");
  createModeTestSuite("CTR");
});

/**
 * 🏗️ Extract image metadata (test-specific implementation)
 *
 * Extracts metadata from image file using node-canvas directly.
 * This avoids blob URL issues in test environment.
 *
 * @param file - 📁 Image file
 * @returns {Promise<ImageMetadata>} 📋 Image metadata
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
 *
 * @param fileName - File name with extension
 * @returns MIME type string
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
