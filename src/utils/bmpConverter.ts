import type { BmpData } from "../types/encryption-method.types";
import { logger } from "../utils/logger";

const BMP_HEADER_SIZE = 54;

/**
 * Converts a File object to an HTMLCanvasElement
 * @param file - Image file (JPG/PNG/BMP)
 * @returns Promise resolving to canvas with rendered image
 */
function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      context.drawImage(image, 0, 0);
      logger.log("Canvas created:", canvas.width, "x", canvas.height);
      resolve(canvas);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    image.src = url;
  });
}

/**
 * Writes a 32-bit unsigned integer to a buffer in little-endian format
 * BMP format requires little-endian byte order for all multi-byte values
 * @param buffer - The buffer to write to
 * @param offset - The byte offset where to start writing
 * @param value - The 32-bit value to write
 */
function writeUInt32LE(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
  buffer[offset + 2] = (value >> 16) & 0xff;
  buffer[offset + 3] = (value >> 24) & 0xff;
}

/**
 * Writes a 32-bit signed integer to a buffer in little-endian format
 * Used for negative height values to indicate top-to-bottom pixel order
 * @param buffer - The buffer to write to
 * @param offset - The byte offset where to start writing
 * @param value - The 32-bit signed value to write
 */
function writeInt32LE(buffer: Uint8Array, offset: number, value: number): void {
  // Convert to 32-bit signed integer using two's complement
  const unsigned = value < 0 ? 0x100000000 + value : value;
  buffer[offset] = unsigned & 0xff;
  buffer[offset + 1] = (unsigned >> 8) & 0xff;
  buffer[offset + 2] = (unsigned >> 16) & 0xff;
  buffer[offset + 3] = (unsigned >> 24) & 0xff;
}

/**
 * Creates the BMP file header (14 bytes)
 * Structure: 'BM' signature (2 bytes) + file size (4 bytes) + reserved (4 bytes) + data offset (4 bytes)
 * @param bmp - The buffer to write the header to
 * @param fileSize - Total size of the BMP file in bytes
 */
function createBmpFileHeader(bmp: Uint8Array, fileSize: number): void {
  bmp[0] = 0x42; // 'B'
  bmp[1] = 0x4d; // 'M'
  writeUInt32LE(bmp, 2, fileSize);
  writeUInt32LE(bmp, 6, 0); // Reserved
  writeUInt32LE(bmp, 10, BMP_HEADER_SIZE);
}

/**
 * DIB header parameters
 */
interface DibHeaderParams {
  bmp: Uint8Array;
  width: number;
  height: number;
  pixelDataSize: number;
}

/**
 * Creates the DIB (Device Independent Bitmap) header (40 bytes)
 * Uses BIT MAP INFO HEADER format with 24-bit RGB color depth and no compression
 * Height is negative to indicate top-to-bottom pixel order (prevents flipping)
 * @param params - DIB header parameters including dimensions and pixel data size
 */
function createDibHeader(params: DibHeaderParams): void {
  const { bmp, width, height, pixelDataSize } = params;
  writeUInt32LE(bmp, 14, 40); // Header size
  writeUInt32LE(bmp, 18, width);
  // Use negative height to indicate top-to-bottom pixel order
  // This prevents the image from appearing flipped after encryption
  writeInt32LE(bmp, 22, -height);
  bmp[26] = 1; // Color planes
  bmp[27] = 0;
  bmp[28] = 24; // Bits per pixel
  bmp[29] = 0;
  writeUInt32LE(bmp, 30, 0); // No compression
  writeUInt32LE(bmp, 34, pixelDataSize);
  writeUInt32LE(bmp, 38, 0x0b13); // 72 DPI
  writeUInt32LE(bmp, 42, 0x0b13); // 72 DPI
  writeUInt32LE(bmp, 46, 0); // Colors in palette
  writeUInt32LE(bmp, 50, 0); // Important colors
}

/**
 * Pixel row parameters
 */
interface PixelRowParams {
  bmp: Uint8Array;
  data: Uint8ClampedArray;
  y: number;
  width: number;
  bmpIndex: number;
}

/**
 * Writes a single row of pixel data in BGR format (BMP uses BGR instead of RGB)
 * @param params - Pixel row parameters including buffer, source data, and position
 * @returns Updated buffer index after writing the row
 */
function writePixelRow(params: PixelRowParams): number {
  const { bmp, data, y, width, bmpIndex } = params;
  let index = bmpIndex;
  for (let x = 0; x < width; x++) {
    const dataIndex = (y * width + x) * 4;
    bmp[index++] = data[dataIndex + 2]; // Blue
    bmp[index++] = data[dataIndex + 1]; // Green
    bmp[index++] = data[dataIndex]; // Red
  }
  return index;
}

/**
 * Pixel data parameters
 */
interface PixelDataParams {
  bmp: Uint8Array;
  data: Uint8ClampedArray;
  width: number;
  height: number;
  rowSize: number;
}

/**
 * Writes pixel data in BGR format with top-to-bottom row order
 * Using top-to-bottom order (with negative height in header) ensures encrypted
 * images display correctly without vertical flipping
 * @param params - Pixel data parameters including dimensions and row size
 */
function writePixelData(params: PixelDataParams): void {
  const { bmp, data, width, height, rowSize } = params;
  let bmpIndex = BMP_HEADER_SIZE;
  const padding = rowSize - width * 3;

  // Write pixels top-to-bottom (y = 0 to height-1)
  // This matches the natural canvas order and prevents flipping after encryption
  for (let y = 0; y < height; y++) {
    bmpIndex = writePixelRow({ bmp, data, y, width, bmpIndex });
    // Add row padding
    for (let paddingIndex = 0; paddingIndex < padding; paddingIndex++) {
      bmp[bmpIndex++] = 0;
    }
  }
}

/**
 * Converts canvas to BMP byte array with proper header construction
 *
 * BMP Format Details:
 * - 24-bit color depth (3 bytes per pixel: BGR)
 * - Bottom-to-top row order (last row first)
 * - Row padding to 4-byte boundary
 * - Little-endian byte order for all multi-byte values
 *
 * @param canvas - Canvas element containing image data
 * @returns Uint8Array containing complete BMP file
 */
function canvasToBmp(canvas: HTMLCanvasElement): Uint8Array {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Failed to get canvas context");
  }

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height, data } = imageData;

  // Calculate row size with padding (rows must be multiple of 4 bytes)
  // Formula: ((bits_per_pixel * width + 31) / 32) * 4
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = BMP_HEADER_SIZE + pixelDataSize;

  const bmp = new Uint8Array(fileSize);

  createBmpFileHeader(bmp, fileSize);
  createDibHeader({ bmp, width, height, pixelDataSize });
  writePixelData({ bmp, data, width, height, rowSize });

  logger.log("BMP created:", fileSize, "bytes");

  // Clear canvas context to free memory
  context.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;

  return bmp;
}

/**
 * Splits BMP byte array into header and body
 * @param bmp - Complete BMP byte array
 * @returns Object containing header (54 bytes) and body (remaining bytes)
 */
function splitBmp(bmp: Uint8Array): BmpData {
  if (bmp.length < BMP_HEADER_SIZE) {
    throw new Error("Invalid BMP: file too small");
  }

  const header = bmp.slice(0, BMP_HEADER_SIZE);
  const body = bmp.slice(BMP_HEADER_SIZE);

  logger.log("BMP split - header:", header.length, "body:", body.length);

  return {
    header,
    body,
    fullBmp: bmp,
  };
}

/**
 * Converts an image file to BMP format and splits it into header and body
 * @param file - Image file (JPG/PNG/BMP)
 * @returns Promise resolving to BmpData with header, body, and full BMP
 */
export async function convertFileToBmp(file: File): Promise<BmpData> {
  logger.log("Converting file to BMP:", file.name);
  const canvas = await fileToCanvas(file);
  const bmp = canvasToBmp(canvas);
  return splitBmp(bmp);
}

/**
 * Creates a BMP Blob from header and body bytes
 * Updates the file size in the header to match the actual combined size
 * @param header - BMP header (54 bytes)
 * @param body - BMP body (pixel data, may be encrypted with different size)
 * @returns Blob with MIME type image/bmp
 */
export function createBmpBlob(header: Uint8Array, body: Uint8Array): Blob {
  // Create a copy of the header to avoid modifying the original
  const updatedHeader = new Uint8Array(header);

  // Update file size in header (bytes 2-5, little-endian)
  const totalSize = header.length + body.length;
  updatedHeader[2] = totalSize & 0xff;
  updatedHeader[3] = (totalSize >> 8) & 0xff;
  updatedHeader[4] = (totalSize >> 16) & 0xff;
  updatedHeader[5] = (totalSize >> 24) & 0xff;

  const combined = new Uint8Array(totalSize);
  combined.set(updatedHeader, 0);
  combined.set(body, header.length);

  logger.log("BMP blob created:", totalSize, "bytes");

  return new Blob([combined], { type: "image/bmp" });
}
