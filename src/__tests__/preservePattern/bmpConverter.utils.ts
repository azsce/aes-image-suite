/**
 * BMP Converter Test Utilities
 *
 * Test-specific BMP conversion using image-js (pure JavaScript, no native dependencies).
 */

import { decode } from "image-js";
import type { BmpData } from "../../types/encryption-method.types";

const BMP_HEADER_SIZE = 54;

/**
 * Convert File to raw pixel data using image-js
 */
async function fileToPixelData(file: File): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Use image-js decode function
  const image = decode(uint8Array);
  
  // Get raw image data
  const rawImage = image.getRawImage();
  const width = rawImage.width;
  const height = rawImage.height;
  const channels = image.channels;
  
  // Convert to RGBA if needed
  let rgbaData: Uint8Array;
  if (channels === 4) {
    rgbaData = new Uint8Array(rawImage.data);
  } else if (channels === 3) {
    // RGB to RGBA
    const rgb = rawImage.data;
    rgbaData = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      rgbaData[i * 4] = rgb[i * 3];
      rgbaData[i * 4 + 1] = rgb[i * 3 + 1];
      rgbaData[i * 4 + 2] = rgb[i * 3 + 2];
      rgbaData[i * 4 + 3] = 255;
    }
  } else {
    throw new Error(`Unsupported channel count: ${String(channels)}`);
  }

  return {
    data: new Uint8ClampedArray(rgbaData),
    width,
    height,
  };
}

/**
 * Write 32-bit unsigned integer in little-endian format
 */
function writeUInt32LE(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
  buffer[offset + 2] = (value >> 16) & 0xff;
  buffer[offset + 3] = (value >> 24) & 0xff;
}

/**
 * Write 32-bit signed integer in little-endian format
 */
function writeInt32LE(buffer: Uint8Array, offset: number, value: number): void {
  const unsigned = value < 0 ? 0x100000000 + value : value;
  buffer[offset] = unsigned & 0xff;
  buffer[offset + 1] = (unsigned >> 8) & 0xff;
  buffer[offset + 2] = (unsigned >> 16) & 0xff;
  buffer[offset + 3] = (unsigned >> 24) & 0xff;
}

/**
 * Create BMP file header
 */
function createBmpFileHeader(bmp: Uint8Array, fileSize: number): void {
  bmp[0] = 0x42;
  bmp[1] = 0x4d;
  writeUInt32LE(bmp, 2, fileSize);
  writeUInt32LE(bmp, 6, 0);
  writeUInt32LE(bmp, 10, BMP_HEADER_SIZE);
}

/**
 * Create DIB header
 */
function createDibHeader(bmp: Uint8Array, width: number, height: number, pixelDataSize: number): void {
  writeUInt32LE(bmp, 14, 40);
  writeUInt32LE(bmp, 18, width);
  writeInt32LE(bmp, 22, -height);
  bmp[26] = 1;
  bmp[27] = 0;
  bmp[28] = 24;
  bmp[29] = 0;
  writeUInt32LE(bmp, 30, 0);
  writeUInt32LE(bmp, 34, pixelDataSize);
  writeUInt32LE(bmp, 38, 0x0b13);
  writeUInt32LE(bmp, 42, 0x0b13);
  writeUInt32LE(bmp, 46, 0);
  writeUInt32LE(bmp, 50, 0);
}

/**
 * Write pixel data in BGR format
 */
function writePixelData(
  bmp: Uint8Array,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  rowSize: number
): void {
  let bmpIndex = BMP_HEADER_SIZE;
  const padding = rowSize - width * 3;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dataIndex = (y * width + x) * 4;
      bmp[bmpIndex++] = data[dataIndex + 2];
      bmp[bmpIndex++] = data[dataIndex + 1];
      bmp[bmpIndex++] = data[dataIndex];
    }
    for (let paddingIndex = 0; paddingIndex < padding; paddingIndex++) {
      bmp[bmpIndex++] = 0;
    }
  }
}

/**
 * Convert pixel data to BMP byte array
 */
function pixelDataToBmp(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = BMP_HEADER_SIZE + pixelDataSize;

  const bmp = new Uint8Array(fileSize);

  createBmpFileHeader(bmp, fileSize);
  createDibHeader(bmp, width, height, pixelDataSize);
  writePixelData(bmp, data, width, height, rowSize);

  return bmp;
}

/**
 * Split BMP into header and body
 */
function splitBmp(bmp: Uint8Array): BmpData {
  if (bmp.length < BMP_HEADER_SIZE) {
    throw new Error("Invalid BMP: file too small");
  }

  const header = bmp.slice(0, BMP_HEADER_SIZE);
  const body = bmp.slice(BMP_HEADER_SIZE);

  return {
    header,
    body,
    fullBmp: bmp,
  };
}

/**
 * Convert File to BMP (test environment version)
 */
export async function convertFileToBmpTest(file: File): Promise<BmpData> {
  const { data, width, height } = await fileToPixelData(file);
  const bmp = pixelDataToBmp(data, width, height);
  return splitBmp(bmp);
}

/**
 * Create BMP blob from header and body
 */
export function createBmpBlobTest(header: Uint8Array, body: Uint8Array): Blob {
  const updatedHeader = new Uint8Array(header);

  const totalSize = header.length + body.length;
  updatedHeader[2] = totalSize & 0xff;
  updatedHeader[3] = (totalSize >> 8) & 0xff;
  updatedHeader[4] = (totalSize >> 16) & 0xff;
  updatedHeader[5] = (totalSize >> 24) & 0xff;

  const combined = new Uint8Array(totalSize);
  combined.set(updatedHeader, 0);
  combined.set(body, header.length);

  return new Blob([combined], { type: "image/bmp" });
}
