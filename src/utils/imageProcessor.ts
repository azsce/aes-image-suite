/**
 * Image metadata interface for lossless encryption
 *
 * This metadata is extracted from the original image and stored separately
 * to enable bit-perfect reconstruction after decryption. The encryption process
 * operates on raw file bits without modifying the image format or data.
 */
export interface ImageMetadata {
  width: number; // Image width in pixels
  height: number; // Image height in pixels
  mimeType: string; // Original MIME type (e.g., "image/png", "image/jpeg")
  filename: string; // Original filename
  fileSize: number; // Original file size in bytes
}

/**
 * Read image file as raw bits without any conversion
 *
 * LOSSLESS ENCRYPTION: This function reads the entire file as raw bytes,
 * preserving all data including headers, metadata, and pixel information.
 * No format conversion or compression is applied, ensuring bit-perfect
 * reconstruction after decryption.
 *
 * @param file - The image file to read
 * @returns Promise resolving to raw file bits as Uint8Array
 */
export async function readImageBits(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Extract image metadata using Image API (for dimensions only)
 *
 * LOSSLESS ENCRYPTION: Metadata is extracted separately and stored alongside
 * the encrypted bits. This allows the original image format to be preserved
 * during decryption, ensuring bit-perfect reconstruction.
 *
 * @param file - The image file to extract metadata from
 * @returns Promise resolving to image metadata (width, height, MIME type, filename, size)
 */
export async function extractImageMetadata(file: File): Promise<ImageMetadata> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.width,
        height: img.height,
        mimeType: file.type,
        filename: file.name,
        fileSize: file.size,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image metadata"));
    };

    img.src = url;
  });
}

/**
 * Create Blob URL from raw bits with specified MIME type
 *
 * LOSSLESS ENCRYPTION: This function creates a Blob URL from raw file bits
 * using the original MIME type. This allows the browser to correctly interpret
 * and display the image after decryption, maintaining the original format.
 *
 * @param bits - Raw file bits (complete file including headers and metadata)
 * @param mimeType - MIME type for the blob (e.g., "image/png", "image/jpeg")
 * @returns Blob URL for visualization in the browser
 */
export function createImageBlobUrl(bits: Uint8Array, mimeType: string): string {
  const blob = new Blob([bits.buffer as ArrayBuffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Download file with original format and extension
 *
 * LOSSLESS ENCRYPTION: Downloads the raw file bits with the original MIME type,
 * preserving the exact file format. The downloaded file will be bit-identical
 * to the original file before encryption.
 *
 * @param bits - Raw file bits to download (complete file data)
 * @param filename - Filename with extension (e.g., "image.png")
 * @param mimeType - MIME type for the blob (e.g., "image/png")
 */
export function downloadImageBits(bits: Uint8Array, filename: string, mimeType: string): void {
  const blob = new Blob([bits.buffer as ArrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
