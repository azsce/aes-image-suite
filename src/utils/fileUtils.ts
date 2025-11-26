export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileExtension(mimeType: string): string {
  // Common mime types map
  const map: Record<string, string> = {
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/jpg": "JPG",
    "image/gif": "GIF",
    "image/webp": "WEBP",
    "image/bmp": "BMP",
    "image/svg+xml": "SVG",
    "text/plain": "TXT",
    "application/pdf": "PDF",
    "application/json": "JSON",
  };

  if (map[mimeType]) return map[mimeType];

  // Fallback: try to extract from mime type string (e.g. "application/zip" -> "ZIP")
  const parts = mimeType.split("/");
  if (parts.length === 2) {
    return parts[1].toUpperCase();
  }

  return "FILE";
}
