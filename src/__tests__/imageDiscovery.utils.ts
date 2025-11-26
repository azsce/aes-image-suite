/**
 * Image Discovery Utilities
 *
 * Helper functions for discovering and validating image files in test directories.
 */

import { readdirSync, statSync } from "fs";
import { join, extname } from "path";

/**
 * Supported image file extensions
 */
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"];

/**
 * Recursively discover all image files in a directory
 *
 * @param dirPath - Directory path to search
 * @returns Array of absolute paths to image files
 */
export function discoverImageFiles(dirPath: string): string[] {
  const imageFiles: string[] = [];

  function traverse(currentPath: string): void {
    const entries = readdirSync(currentPath);

    for (const entry of entries) {
      const fullPath = join(currentPath, entry);
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        traverse(fullPath);
        continue;
      }

      if (!stats.isFile()) {
        continue;
      }

      const ext = extname(entry).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        imageFiles.push(fullPath);
      }
    }
  }

  traverse(dirPath);
  return imageFiles;
}

/**
 * Assert that at least one valid image file exists in the discovered files
 *
 * @param imageFiles - Array of image file paths
 * @throws Error if no image files are found
 */
export function assertImageFilesExist(imageFiles: string[]): void {
  if (imageFiles.length === 0) {
    throw new Error("No valid image files found in test directory");
  }
}
