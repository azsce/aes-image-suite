export type EncryptionMethodType = "whole-file" | "pixel-data";

export type CompressionStatus = "compressed" | "uncompressed" | null;

export interface ImageFormatInfo {
  format: "PNG" | "JPEG" | "BMP" | "UNKNOWN";
  isCompressed: boolean;
  mimeType: string;
}

export interface BmpData {
  header: Uint8Array; // 54 bytes
  body: Uint8Array; // Pixel data
  fullBmp: Uint8Array; // Complete BMP
}
