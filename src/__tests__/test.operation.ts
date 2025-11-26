// Application Utilities - Crypto Engine
import { encrypt, decrypt } from "../utils/cryptoEngine";

// Application Utilities - Hex Utils
import { hexToBytes, bytesToHex } from "../utils/hexUtils";

// Application Utilities - Key File Handler
import { parseBinaryKeyFile } from "../utils/keyFileHandler";

// Application Utilities - JSZip
import JSZip from "jszip";


import * as TestTypes from "./test.types";

// TypeScript Types
import type { EncryptionMode, ImageMetadata } from "../types/crypto.types";

// ============================================================================
// 🔧 OPERATION HELPERS
// ============================================================================

/**
 * 🔧 Determine encryption mode from test data
 *
 * Helper to extract mode from test metadata.
 * In tests, we store the mode in a custom property.
 *
 * @param metadata - 📋 Image metadata with mode info
 * @returns {EncryptionMode} 🔀 Encryption mode
 */
export function determineMode(metadata: ImageMetadata): EncryptionMode {
  // In tests, we'll pass mode through the test data structure
  // This is a workaround since binary key files don't store the mode
  return (metadata as ImageMetadata & { mode?: EncryptionMode }).mode || "ECB";
}

/**
 * 🔧 Load encrypted image and key from disk
 *
 * Helper to eliminate code duplication in test cases.
 * Reads binary key file and parses it to extract encryption parameters.
 *
 * @param encryptedImagePath - 📁 Path to encrypted image
 * @param keyFilePath - 📁 Path to binary key file
 * @param mode - 🔀 Encryption mode (needed since binary format doesn't store mode)
 * @returns {Promise<LoadedTestData>} 📦 Loaded test data
 */
export async function loadEncryptedImageAndKey(
  encryptedImagePath: TestTypes.EncryptedImagePath,
  keyFilePath: TestTypes.KeyFilePath,
  mode: EncryptionMode
): Promise<{ encryptedBmp: Uint8Array; keyData: TestTypes.KeyFileData; decParams: TestTypes.DecryptionParams }> {
  const encryptedBmp = new Uint8Array(await Bun.file(encryptedImagePath).arrayBuffer());
  const keyFileBuffer = new Uint8Array(await Bun.file(keyFilePath).arrayBuffer());
  
  // Parse binary key file - returns KeyFileData with Uint8Array
  const keyData = parseBinaryKeyFile(keyFileBuffer);

  // Create decryption params with hex strings
  const decParams: TestTypes.DecryptionParams = {
    mode,
    key: bytesToHex(keyData.key),
    iv: keyData.iv ? bytesToHex(keyData.iv) : undefined,
  };

  return { encryptedBmp, keyData, decParams };
}

/**
 * 🔧 Perform encryption operation
 *
 * Mimics the encryption workflow from EncryptionMode.tsx
 * but without using Web Workers.
 *
 * @param imageBits - 📦 Raw image bits to encrypt
 * @param metadata - 📋 Image metadata
 * @param params - 🔑 Encryption parameters
 * @returns {Promise<EncryptionResult>} �� Encryption result
 */
export function performEncryption(imageBits: Uint8Array, metadata: ImageMetadata, params: TestTypes.EncryptionParams):TestTypes. EncryptionResult {
  // Convert key to bytes
  const keyBytes = hexToBytes(params.key);

  // Convert IV to bytes if present
  const ivBytes = params.iv ? hexToBytes(params.iv) : undefined;

  // Call encrypt function directly (no worker)
  const encryptedBits = encrypt(imageBits, keyBytes, params.mode, ivBytes);

  return {
    encrypted: encryptedBits,
    original: imageBits,
    mode: params.mode,
    metadata,
    params,
  };
}

/**
 * 🔧 Perform decryption operation
 *
 * Mimics the decryption workflow from DecryptionMode.tsx
 * but without using Web Workers.
 *
 * @param encryptedBits - 🔒 Encrypted image bits
 * @param metadata - 📋 Image metadata
 * @param params - 🔓 Decryption parameters
 * @returns {DecryptionResult} 🔓 Decryption result
 */
export function performDecryption(
  encryptedBits: Uint8Array,
  metadata: ImageMetadata,
  params:TestTypes. DecryptionParams
): TestTypes.DecryptionResult {
  // Convert key to bytes
  const keyBytes = hexToBytes(params.key);

  // Convert IV to bytes if present
  const ivBytes = params.iv ? hexToBytes(params.iv) : undefined;

  // Call decrypt function directly (no worker)
  const decryptedBits = decrypt(encryptedBits, keyBytes, params.mode, ivBytes);

  return {
    decrypted: decryptedBits,
    metadata,
    mode: params.mode,
  };
}

/**
 * 🔧 Extract contents from bundle
 *
 * Extracts encrypted image and binary key file from ZIP bundle.
 * Note: This function extracts user-provided ZIP files in a test environment.
 * In production, additional validation should be performed.
 *
 * @param zip - 📦 ZIP bundle
 * @returns {Promise<ExtractedBundle>} 📂 Extracted contents
 */
export async function extractBundle(zip: JSZip): Promise<TestTypes.ExtractedBundle> {
  // Get file list from zip
  const files = zip.files;
  const fileNames = Object.keys(files);

  // Find encrypted image file (.enc extension)
  const imageFileName = fileNames.find(name => name.toLowerCase().endsWith(".enc"));
  if (!imageFileName) {
    throw new Error("No .enc file found in bundle");
  }

  // Find binary key file (no extension, contains "encryption-key")
  const keyFileName = fileNames.find(name => name.includes("encryption-key") && !name.includes("."));
  if (!keyFileName) {
    throw new Error("No binary key file found in bundle");
  }

  // Extract image as Uint8Array
  const encryptedImage = await files[imageFileName].async("uint8array");

  // Extract binary key file as Uint8Array
  const keyFileBuffer = await files[keyFileName].async("uint8array");

  // Parse binary key file - returns KeyFileData with Uint8Array
  const keyData = parseBinaryKeyFile(keyFileBuffer);

  return {
    zip,
    encryptedImage,
    keyData,
  };
}

/**
 * 🔧 Compare pixel data byte-by-byte
 *
 * Compares two Uint8Arrays byte-by-byte to detect differences.
 *
 * @param data1 - 📄 First data array
 * @param data2 - 📄 Second data array
 * @returns {ComparisonResult} 🔍 Comparison result
 */
export function comparePixelData(data1: Uint8Array, data2: Uint8Array):TestTypes. ComparisonResult {
  // Check if lengths match
  if (data1.length !== data2.length) {
    return {
      identical: false,
      differenceCount: Math.abs(data1.length - data2.length),
      totalPixels: Math.max(data1.length, data2.length),
    };
  }

  // Iterate through each byte and count differences
  let differenceCount = 0;
  for (let i = 0; i < data1.length; i++) {
    if (data1[i] !== data2[i]) {
      differenceCount++;
    }
  }

  return {
    identical: differenceCount === 0,
    differenceCount,
    totalPixels: data1.length,
  };
}