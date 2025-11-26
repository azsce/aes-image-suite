// Application Utilities - Hex Utils
import { hexToBytes, generateKey, generateIV } from "../utils/hexUtils";

// Application Utilities - Key File Handler
import { generateBinaryKeyFile } from "../utils/keyFileHandler";

// Application Utilities - JSZip
import JSZip from "jszip";

// TypeScript Types
import type { EncryptionMode, ImageMetadata } from "../types/crypto.types";

import * as TestTypes from "./test.types";

import { readImageBits } from "../utils/imageProcessor";

// ============================================================================
// 🏗️ TEST DATA HELPERS
// ============================================================================

/**
 * 🏗️ Read image file as raw bits
 *
 * Reads image file as raw binary data without any conversion.
 *
 * @param file - 📁 Image file to read
 * @returns {Promise<Uint8Array>} 📦 Raw image bits
 */
export async function readImageFile(file: File): Promise<Uint8Array> {
  return await readImageBits(file);
}

/**
 * 🏗️ Create blob URL from raw bits
 *
 * Creates a blob URL for visualization from raw image bits.
 *
 * @param bits - 📦 Raw image bits
 * @param mimeType - 🎨 MIME type
 * @returns {string} 🔗 Blob URL
 */
export function createBlobUrl(bits: Uint8Array, mimeType: string): string {
  const blob = new Blob([new Uint8Array(bits)], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * 🏗️ Create encryption parameters for a specific mode
 *
 * Generates random key and IV (if needed) for the specified
 * encryption mode.
 *
 * @param mode - 🔀 Encryption mode (ECB, CBC, or CTR)
 * @returns {EncryptionParams} 🔑 Encryption parameters
 */
export function createEncryptionParams(mode: EncryptionMode): TestTypes.EncryptionParams {
  const key = generateKey();
  const iv = mode !== "ECB" ? generateIV() : undefined;
  return { mode, key, iv };
}

/**
 * 🏗️ Create test bundle with encrypted image and key file
 *
 * Creates a ZIP bundle containing the encrypted image and
 * its corresponding binary key file (matching production format).
 *
 * @param encryptedBits - 🔒 Encrypted image bits
 * @param params - 🔑 Encryption parameters
 * @param metadata - 📋 Image metadata
 * @returns {JSZip} 📦 ZIP bundle
 */
export function createTestBundle(encryptedBits: Uint8Array, params:TestTypes. EncryptionParams, metadata: ImageMetadata): JSZip {
  const zip = new JSZip();

  // Add encrypted image to bundle with .enc extension (matching production)
  const originalName = metadata.filename.replace(/\.[^/.]+$/, "");
  zip.file(`encrypted-${originalName}.enc`, encryptedBits);

  // Generate binary key file (same format as production)
  const keyBytes = hexToBytes(params.key);
  const ivBytes = params.iv ? hexToBytes(params.iv) : undefined;
  const keyFileBits = generateBinaryKeyFile(keyBytes, params.mode, ivBytes);
  zip.file("encryption-key", keyFileBits);

  return zip;
}