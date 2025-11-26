/**
 * AES Padding Integration Tests - Standard Encryption (Whole File)
 *
 * Tests PKCS7 padding/unpadding for whole-file encryption across all 16 possible
 * padding values (1-16 bytes) for ECB and CBC modes, plus CTR mode (no padding).
 *
 * Test Coverage:
 * - Synthetic data: All 16 padding values for ECB and CBC
 * - Real images: Natural padding values for all modes
 * - CTR mode: Verifies no padding is applied
 */

import "../setupt";

// Test Framework - Bun test runner
import { describe, it, beforeAll } from "bun:test";

// Padding test utilities
import {
  testPaddingRoundTrip,
  testCtrNoPadding,
  generateSyntheticData,
  calculateSizeForPadding,
} from "../padding.utils";

// Image discovery utilities
import { discoverImageFiles, assertImageFilesExist } from "../imageDiscovery.utils";

// Test data utilities
import { readImageFile } from "../test.data..utils";

describe("AES Padding Tests - Standard Encryption (Whole File)", () => {
  describe("Synthetic Data - All Padding Values", () => {
    describe("ECB Mode", () => {
      for (let padding = 1; padding <= 16; padding++) {
        it(`should handle padding value ${String(padding)}`, () => {
          const data = generateSyntheticData(calculateSizeForPadding(padding));
          testPaddingRoundTrip({ originalBits: data, mode: "ECB", expectedPadding: padding });
        });
      }
    });

    describe("CBC Mode", () => {
      for (let padding = 1; padding <= 16; padding++) {
        it(`should handle padding value ${String(padding)}`, () => {
          const data = generateSyntheticData(calculateSizeForPadding(padding));
          testPaddingRoundTrip({ originalBits: data, mode: "CBC", expectedPadding: padding });
        });
      }
    });
  });

  describe("Real Images - Natural Padding", () => {
    let testImageFiles: File[] = [];

    beforeAll(async () => {
      const imagesDir = new URL("../images", import.meta.url).pathname;
      const imagePaths = discoverImageFiles(imagesDir);
      assertImageFilesExist(imagePaths);

      testImageFiles = await Promise.all(
        imagePaths.map(async path => {
          const buffer = await Bun.file(path).arrayBuffer();
          const filename = path.split("/").pop() || "unknown.png";
          return new File([buffer], filename, { type: "image/png" });
        })
      );
    });

    it("should encrypt and decrypt real images with ECB", async () => {
      for (const file of testImageFiles) {
        const bits = await readImageFile(file);
        testPaddingRoundTrip({ originalBits: bits, mode: "ECB" });
      }
    });

    it("should encrypt and decrypt real images with CBC", async () => {
      for (const file of testImageFiles) {
        const bits = await readImageFile(file);
        testPaddingRoundTrip({ originalBits: bits, mode: "CBC" });
      }
    });
  });

  describe("CTR Mode - No Padding", () => {
    it("should not apply padding to synthetic data", () => {
      const data = generateSyntheticData(1023);
      testCtrNoPadding({ originalBits: data });
    });

    it("should not apply padding to real images", async () => {
      const imagesDir = new URL("../images", import.meta.url).pathname;
      const imagePaths = discoverImageFiles(imagesDir);
      assertImageFilesExist(imagePaths);

      const testImageFiles = await Promise.all(
        imagePaths.map(async path => {
          const buffer = await Bun.file(path).arrayBuffer();
          const filename = path.split("/").pop() || "unknown.png";
          return new File([buffer], filename, { type: "image/png" });
        })
      );

      for (const file of testImageFiles) {
        const bits = await readImageFile(file);
        testCtrNoPadding({ originalBits: bits });
      }
    });
  });
});
