/**
 * Utility for visualizing encrypted image data
 *
 * EDUCATIONAL VISUALIZATION: This module demonstrates why ECB mode is insecure
 * by revealing patterns in encrypted data. It uses a "hacker approach" to
 * visualize encrypted bits as pixels, showing how ECB mode preserves patterns
 * from the original image (like the famous ECB penguin).
 *
 * IMPORTANT: This is for visualization only. The actual encrypted file remains
 * secure and lossless - this visualization doesn't affect the encryption quality.
 */

import type { ImageMetadata } from "@/types/crypto.types";

/**
 * Find where the actual image data starts in a PNG file
 *
 * HEURISTIC APPROACH: Since the file is encrypted, we can't parse the actual
 * PNG structure. Instead, we estimate the header size and skip it to get to
 * the bulk of the image data. This is where patterns are most visible.
 *
 * PNG structure: [Signature 8 bytes][Header chunk][...other chunks][Image data chunk(s)]
 * Typical header size: 100-300 bytes depending on metadata
 *
 * For ECB mode, we align to AES block boundaries (16 bytes) for cleaner patterns.
 */
function findImageDataOffset(encryptedBits: Uint8Array): number {
  // PNG signature is 8 bytes: 137 80 78 71 13 10 26 10
  // After that come chunks: [length 4 bytes][type 4 bytes][data][CRC 4 bytes]

  // For encrypted PNG, the signature is scrambled, so we can't rely on it
  // Instead, we'll use a heuristic: skip the first ~100-200 bytes (typical header size)
  // This is where a hacker would start experimenting

  // PNG headers are typically 100-300 bytes depending on metadata
  // Let's skip a reasonable amount to get past headers into image data
  const estimatedHeaderSize = Math.min(200, Math.floor(encryptedBits.length * 0.05));

  return estimatedHeaderSize;
}

export interface VisualizationOptions {
  method: "ECB" | "CBC" | "CTR";
  keySize: 128 | 192 | 256;
}

/**
 * Create a visualization of encrypted bits as an image using Canvas
 *
 * HACKER TECHNIQUE:
 * 1. Skip encrypted file headers (first ~200 bytes)
 * 2. Treat remaining encrypted bytes as raw pixel data
 * 3. Map bytes directly to RGB values
 * 4. Render to canvas
 *
 * This reveals ECB patterns because:
 * - ECB encrypts identical blocks identically
 * - Image data has repetitive patterns (solid colors, gradients)
 * - These patterns survive in the encrypted data
 *
 * @param encryptedBits - The encrypted image file (full file encryption)
 * @param metadata - Original image metadata (width, height, mimeType)
 * @param options - Encryption options (method, keySize) for proper visualization
 * @returns Promise resolving to Blob URL of the visualized encrypted data as PNG
 */
export function visualizeEncryptedBits(
  encryptedBits: Uint8Array,
  metadata: ImageMetadata,
  options?: VisualizationOptions
): Promise<string> {
  const { width, height } = metadata;

  // AES block size is always 16 bytes
  const AES_BLOCK_SIZE = 16;

  // HACK: Skip file headers to get to image data
  // For better ECB pattern visualization, align to AES block boundaries
  let dataOffset = findImageDataOffset(encryptedBits);

  // Align offset to AES block boundary for cleaner pattern visualization
  if (options?.method === "ECB") {
    dataOffset = Math.floor(dataOffset / AES_BLOCK_SIZE) * AES_BLOCK_SIZE;
  }

  const imageDataBytes = encryptedBits.slice(dataOffset);

  // Create canvas with original dimensions
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Create ImageData to hold pixels
  const imageData = ctx.createImageData(width, height);
  const pixels = imageData.data; // RGBA array (4 bytes per pixel)

  // Calculate how many pixels we need
  const totalPixels = width * height;

  // HACK: Map encrypted bytes directly to RGB pixels
  // Use 3 bytes per pixel (RGB), set alpha to 255
  let dataIndex = 0;

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex++) {
    const pixelOffset = pixelIndex * 4;

    // R, G, B from encrypted image data (cycling if we run out)
    pixels[pixelOffset] = imageDataBytes[dataIndex % imageDataBytes.length];
    pixels[pixelOffset + 1] = imageDataBytes[(dataIndex + 1) % imageDataBytes.length];
    pixels[pixelOffset + 2] = imageDataBytes[(dataIndex + 2) % imageDataBytes.length];

    // Alpha channel always 255 (fully opaque)
    pixels[pixelOffset + 3] = 255;

    dataIndex += 3;
  }

  // Put the pixel data on canvas
  ctx.putImageData(imageData, 0, 0);

  // Convert canvas to blob URL
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(URL.createObjectURL(blob));
      } else {
        reject(new Error("Failed to create blob from canvas"));
      }
    }, "image/png");
  });
}

/**
 * Synchronous version that returns a data URL instead of blob URL
 *
 * SIMPLIFIED VISUALIZATION: This version provides immediate rendering without
 * async operations. It's less sophisticated than the async version but useful
 * for quick previews. Maps encrypted bytes directly to RGBA pixels.
 *
 * @param encryptedBits - The encrypted image file bits
 * @param metadata - Original image metadata (width, height)
 * @returns Data URL of the visualized encrypted data as PNG
 */
export function visualizeEncryptedBitsSync(encryptedBits: Uint8Array, metadata: ImageMetadata): string {
  const { width, height } = metadata;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  const imageData = ctx.createImageData(width, height);
  const pixels = imageData.data;

  const totalPixels = width * height;
  const bytesPerPixel = 4;
  const requiredBytes = totalPixels * bytesPerPixel;

  for (let i = 0; i < requiredBytes; i++) {
    const encryptedByteIndex = i % encryptedBits.length;
    pixels[i] = encryptedBits[encryptedByteIndex];
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
}
