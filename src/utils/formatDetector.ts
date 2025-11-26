import type { ImageFormatInfo } from "@/types/encryption-method.types";
import { logger } from "@/utils/logger";

type MagicNumber = readonly number[];

interface FormatSignature {
  readonly signature: MagicNumber;
  readonly info: ImageFormatInfo;
}

const FORMAT_SIGNATURES: readonly FormatSignature[] = [
  {
    signature: [0x89, 0x50, 0x4e, 0x47],
    info: { format: "PNG", isCompressed: true, mimeType: "image/png" },
  },
  {
    signature: [0xff, 0xd8, 0xff],
    info: { format: "JPEG", isCompressed: true, mimeType: "image/jpeg" },
  },
  {
    signature: [0x42, 0x4d],
    info: { format: "BMP", isCompressed: false, mimeType: "image/bmp" },
  },
] as const;

function matchesSignature(bytes: Uint8Array, signature: MagicNumber): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function detectFormatFromBytes(bytes: Uint8Array): ImageFormatInfo | null {
  for (const { signature, info } of FORMAT_SIGNATURES) {
    if (matchesSignature(bytes, signature)) {
      logger.log(`Detected ${info.format} format`);
      return info;
    }
  }
  return null;
}

/**
 * Detects image format using file headers (magic numbers)
 * @param file - The image file to detect
 * @returns ImageFormatInfo with format, compression status, and MIME type
 */
export async function detectImageFormat(file: File): Promise<ImageFormatInfo> {
  try {
    const buffer = await file.slice(0, 4).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    logger.log("Format detection - magic numbers:", Array.from(bytes));

    const detectedFormat = detectFormatFromBytes(bytes);
    if (detectedFormat) {
      return detectedFormat;
    }

    logger.warn("Unknown format, falling back to MIME type:", file.type);
    return { format: "UNKNOWN", isCompressed: true, mimeType: file.type };
  } catch (error) {
    logger.error("Format detection failed:", error);
    throw new Error("Failed to detect image format");
  }
}
