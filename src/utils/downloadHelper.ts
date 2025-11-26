import JSZip from "jszip";
import { format } from "date-fns";
import { generateBinaryKeyFile, type EncryptionMethod } from "./keyFileHandler";
import { sanitizeFilename, SafeFilename } from "./validation";
import { hexToBytes } from "./hexUtils";

/**
 * Generate a filename with timestamp
 * @param prefix - The prefix for the filename
 * @param extension - The file extension (without dot)
 * @returns Formatted filename with timestamp (sanitized)
 */
export const generateFilename = (prefix: string, extension: string): string => {
  const sanitizedPrefix = sanitizeFilename(new SafeFilename(prefix));
  const timestamp = format(new Date(), "yyyyMMdd-HHmmss");
  return `${sanitizedPrefix}-${timestamp}.${extension}`;
};

/**
 * Trigger download of an image
 * @param imageUrl - The data URL or blob URL of the image
 * @param filename - The filename for the download (will be sanitized)
 */
export const downloadImage = (imageUrl: string, filename: string): void => {
  const sanitizedFilename = sanitizeFilename(new SafeFilename(filename));
  const link = document.createElement("a");
  link.href = imageUrl;
  link.download = sanitizedFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export interface DownloadBundleOptions {
  encryptedImageUrl: string;
  key: string;
  iv: string | undefined;
  method: EncryptionMethod;
  originalFilename?: string;
}

/**
 * Create and download a ZIP bundle containing an image and key file
 * @param options - Bundle download options
 */
export const downloadBundle = async (options: DownloadBundleOptions): Promise<void> => {
  const { encryptedImageUrl, key, iv, method, originalFilename } = options;
  try {
    const zip = new JSZip();

    // Convert data URL to blob
    const response = await fetch(encryptedImageUrl);
    const imageBlob = await response.blob();

    // Generate filenames with sanitization
    const timestamp = format(new Date(), "yyyyMMdd-HHmmss");
    let imageFilename: string;

    if (originalFilename) {
      // Sanitize the original filename and remove extension
      const sanitizedName = sanitizeFilename(new SafeFilename(originalFilename.replace(/\.[^/.]+$/, "")));
      imageFilename = `encrypted-${sanitizedName}-${timestamp}.enc`;
    } else {
      imageFilename = `encrypted-image-${timestamp}.enc`;
    }

    const keyFilename = `encryption-key-${timestamp}`;

    // Add encrypted image to zip
    zip.file(imageFilename, imageBlob);

    // Generate and add binary key file to zip (same format as download key button)
    const keyBytes = hexToBytes(key);
    const ivBytes = iv ? hexToBytes(iv) : undefined;
    const keyFileBits = generateBinaryKeyFile(keyBytes, method, ivBytes);
    const keyFileBlob = new Blob([keyFileBits.buffer as ArrayBuffer], { type: "application/octet-stream" });
    zip.file(keyFilename, keyFileBlob);

    // Generate zip file
    const zipBlob = await zip.generateAsync({ type: "blob" });

    // Trigger download with sanitized bundle name
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = sanitizeFilename(new SafeFilename(`encryption-bundle-${timestamp}.zip`));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(`Failed to create download bundle: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};
