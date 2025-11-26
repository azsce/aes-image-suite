/**
 * AES Padding Integration Tests - BMP Pixel Data Encryption
 *
 * Tests PKCS7 padding/unpadding for BMP pixel-data encryption across all 16 possible
 * padding values (1-16 bytes) for ECB and CBC modes, plus CTR mode (no padding).
 *
 * Test Coverage:
 * - Synthetic data: All 16 padding values for ECB and CBC
 * - Real images: Natural padding values for all modes
 * - CTR mode: Verifies no padding is applied
 */

import "../setupt";

// Test Framework - Bun test runner
import { describe, it } from "bun:test";

// Padding test utilities
import {
  testBmpPaddingRoundTrip,
  testCtrNoPadding,
  calculateSizeForPadding,
  createSyntheticBmpData,
} from "../padding.utils";

describe("AES Padding Tests - BMP Pixel Data Encryption", () => {
  describe("Synthetic Data - All Padding Values", () => {
    describe("ECB Mode", () => {
      for (let padding = 1; padding <= 16; padding++) {
        it(`should handle padding value ${String(padding)} with BMP`, () => {
          const { header, body } = createSyntheticBmpData(calculateSizeForPadding(padding));
          testBmpPaddingRoundTrip({ bmpHeader: header, bmpBody: body, mode: "ECB", expectedPadding: padding, originalBits: body });
        });
      }
    });

    describe("CBC Mode", () => {
      for (let padding = 1; padding <= 16; padding++) {
        it(`should handle padding value ${String(padding)} with BMP`, () => {
          const { header, body } = createSyntheticBmpData(calculateSizeForPadding(padding));
          testBmpPaddingRoundTrip({ bmpHeader: header, bmpBody: body, mode: "CBC", expectedPadding: padding, originalBits: body });
        });
      }
    });
  });

  describe("Real-world BMP Body Sizes", () => {
    it("should encrypt and decrypt various BMP body sizes with ECB", () => {
      const bodySizes = [1920 * 1080 * 3, 1024 * 768 * 3, 800 * 600 * 3, 640 * 480 * 3];
      
      for (const size of bodySizes) {
        const { header, body } = createSyntheticBmpData(size);
        testBmpPaddingRoundTrip({ bmpHeader: header, bmpBody: body, mode: "ECB", originalBits: body });
      }
    });

    it("should encrypt and decrypt various BMP body sizes with CBC", () => {
      const bodySizes = [1920 * 1080 * 3, 1024 * 768 * 3, 800 * 600 * 3, 640 * 480 * 3];
      
      for (const size of bodySizes) {
        const { header, body } = createSyntheticBmpData(size);
        testBmpPaddingRoundTrip({ bmpHeader: header, bmpBody: body, mode: "CBC", originalBits: body });
      }
    });
  });

  describe("CTR Mode - No Padding", () => {
    it("should not apply padding to BMP body (synthetic)", () => {
      const { body } = createSyntheticBmpData(1023);
      testCtrNoPadding({ originalBits: body });
    });

    it("should not apply padding to BMP body (various sizes)", () => {
      const bodySizes = [1920 * 1080 * 3, 1024 * 768 * 3, 800 * 600 * 3];
      
      for (const size of bodySizes) {
        const { body } = createSyntheticBmpData(size);
        testCtrNoPadding({ originalBits: body });
      }
    });
  });
});
