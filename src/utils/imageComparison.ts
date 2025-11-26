import { logger } from "../utils/logger";

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ComparisonResult {
  identical: boolean;
  differencePercentage: number;
  dimensionMismatch: boolean;
  dimensions: {
    imageA: ImageDimensions;
    imageB: ImageDimensions;
  };
  pixelsDifferent: number;
  totalPixels: number;
  details: string;
}

/**
 * Bit-level comparison result interface
 *
 * LOSSLESS ENCRYPTION VERIFICATION: This interface represents the result of
 * a bit-by-bit comparison between two files. When encryption/decryption is
 * performed correctly, the comparison should show 100% bit-perfect match
 * (identical: true, differenceCount: 0).
 */
export interface BitComparisonResult {
  identical: boolean; // True if files are bit-identical (100% match)
  differenceCount: number; // Number of bits that differ between files
  totalBits: number; // Total number of bits compared
  differencePercentage: number; // Percentage of bits that differ (0.0000% for perfect match)
  sizeMismatch: boolean; // True if file sizes differ
  details: string; // Human-readable comparison summary
}

/**
 * Load an image from a data URL
 * @param imageUrl - The data URL of the image
 * @returns Promise resolving to an HTMLImageElement
 */
const loadImage = (imageUrl: string): Promise<HTMLImageElement> => {
  logger.log("[imageComparison] 🖼️ Loading image", {
    urlLength: imageUrl.length,
    urlPrefix: imageUrl.substring(0, 50),
  });

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      logger.log("[imageComparison] ✅ Image loaded successfully", {
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
      resolve(img);
    };
    img.onerror = () => {
      logger.error("[imageComparison] ❌ Failed to load image");
      reject(new Error("Failed to load image"));
    };
    img.src = imageUrl;
  });
};

/**
 * Convert an image to ImageData
 * @param img - The image element
 * @returns ImageData containing pixel data
 */
const imageToImageData = (img: HTMLImageElement): ImageData => {
  logger.log("[imageComparison] 🎨 Converting image to ImageData", {
    width: img.width,
    height: img.height,
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    logger.error("[imageComparison] ❌ Failed to get canvas context");
    throw new Error("Failed to get canvas context");
  }

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  logger.log("[imageComparison] ✅ ImageData created", {
    dataLength: imageData.data.length,
    width: imageData.width,
    height: imageData.height,
  });

  // Clear canvas context to free memory
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;

  return imageData;
};

/**
 * Checks if two images have matching dimensions
 * @param dimensionsA - Dimensions of the first image
 * @param dimensionsB - Dimensions of the second image
 * @returns True if both width and height match
 */
const checkDimensionMatch = (dimensionsA: ImageDimensions, dimensionsB: ImageDimensions): boolean => {
  const match = dimensionsA.width === dimensionsB.width && dimensionsA.height === dimensionsB.height;
  logger.log("[imageComparison] 📏 Checking dimension match", {
    dimensionsA,
    dimensionsB,
    match,
  });
  return match;
};

/**
 * Creates a comparison result for images with mismatched dimensions
 * When dimensions don't match, pixel comparison is skipped
 * @param dimensionsA - Dimensions of the first image
 * @param dimensionsB - Dimensions of the second image
 * @returns ComparisonResult indicating dimension mismatch
 */
const createDimensionMismatchResult = (
  dimensionsA: ImageDimensions,
  dimensionsB: ImageDimensions
): ComparisonResult => {
  const widthA = String(dimensionsA.width);
  const heightA = String(dimensionsA.height);
  const widthB = String(dimensionsB.width);
  const heightB = String(dimensionsB.height);

  const result = {
    identical: false,
    differencePercentage: 100,
    dimensionMismatch: true,
    dimensions: {
      imageA: dimensionsA,
      imageB: dimensionsB,
    },
    pixelsDifferent: 0,
    totalPixels: 0,
    details: `Images have different dimensions: ${widthA}x${heightA} vs ${widthB}x${heightB}`,
  };

  logger.log("[imageComparison] ⚠️ Created dimension mismatch result", result);
  return result;
};

/**
 * Compares pixel data between two images by checking RGBA values
 * Iterates through all pixels and counts differences
 * @param dataA - ImageData of the first image
 * @param dataB - ImageData of the second image
 * @returns Number of pixels that differ between the two images
 */
const comparePixelData = (dataA: ImageData, dataB: ImageData): number => {
  logger.log("[imageComparison] 🔍 Starting pixel comparison", {
    totalBytes: dataA.data.length,
    totalPixels: dataA.data.length / 4,
  });

  const startTime = performance.now();
  let pixelsDifferent = 0;

  for (let i = 0; i < dataA.data.length; i += 4) {
    const rA = dataA.data[i];
    const gA = dataA.data[i + 1];
    const bA = dataA.data[i + 2];
    const aA = dataA.data[i + 3];

    const rB = dataB.data[i];
    const gB = dataB.data[i + 1];
    const bB = dataB.data[i + 2];
    const aB = dataB.data[i + 3];

    const pixelsDiffer = rA !== rB || gA !== gB || bA !== bB || aA !== aB;
    if (pixelsDiffer) {
      pixelsDifferent++;
    }
  }

  const endTime = performance.now();
  const duration = endTime - startTime;

  logger.log("[imageComparison] ✅ Pixel comparison complete", {
    pixelsDifferent,
    totalPixels: dataA.data.length / 4,
    durationMs: duration.toFixed(2),
  });

  return pixelsDifferent;
};

interface ComparisonMetrics {
  identical: boolean;
  pixelsDifferent: number;
  totalPixels: number;
  differencePercentage: number;
}

/**
 * Generates human-readable comparison details text
 * @param metrics - Comparison metrics containing all necessary data
 * @returns Formatted string describing the comparison result
 */
const generateComparisonDetails = (metrics: ComparisonMetrics): string => {
  const details = metrics.identical
    ? "Images are identical"
    : `${metrics.pixelsDifferent.toLocaleString()} of ${metrics.totalPixels.toLocaleString()} pixels differ (${metrics.differencePercentage.toFixed(2)}%)`;

  logger.log("[imageComparison] 📝 Generated comparison details", {
    ...metrics,
    details,
  });

  return details;
};

/**
 * Compare two images pixel by pixel
 * @deprecated This function uses Canvas-based pixel comparison which is lossy.
 * Use compareImageBits() instead for bit-perfect lossless comparison.
 * @param imageAUrl - Data URL of the first image
 * @param imageBUrl - Data URL of the second image
 * @returns Promise resolving to comparison result
 */
export const compareImages = async (imageAUrl: string, imageBUrl: string): Promise<ComparisonResult> => {
  logger.log("[imageComparison] 🚀 Starting image comparison", {
    imageAUrlLength: imageAUrl.length,
    imageBUrlLength: imageBUrl.length,
  });

  const overallStartTime = performance.now();

  try {
    logger.log("[imageComparison] 📥 Loading both images in parallel");
    const [imgA, imgB] = await Promise.all([loadImage(imageAUrl), loadImage(imageBUrl)]);

    const dimensionsA = { width: imgA.width, height: imgA.height };
    const dimensionsB = { width: imgB.width, height: imgB.height };

    logger.log("[imageComparison] 📐 Images loaded, checking dimensions", {
      dimensionsA,
      dimensionsB,
    });

    if (!checkDimensionMatch(dimensionsA, dimensionsB)) {
      logger.log("[imageComparison] ⚠️ Dimension mismatch detected, returning early");
      return createDimensionMismatchResult(dimensionsA, dimensionsB);
    }

    logger.log("[imageComparison] ✅ Dimensions match, converting to ImageData");
    const dataA = imageToImageData(imgA);
    const dataB = imageToImageData(imgB);

    const totalPixels = dimensionsA.width * dimensionsA.height;
    logger.log("[imageComparison] 🔢 Starting pixel-by-pixel comparison", {
      totalPixels,
    });

    const pixelsDifferent = comparePixelData(dataA, dataB);

    const identical = pixelsDifferent === 0;
    const differencePercentage = (pixelsDifferent / totalPixels) * 100;
    const metrics: ComparisonMetrics = {
      identical,
      pixelsDifferent,
      totalPixels,
      differencePercentage,
    };
    const details = generateComparisonDetails(metrics);

    const result = {
      identical,
      differencePercentage,
      dimensionMismatch: false,
      dimensions: {
        imageA: dimensionsA,
        imageB: dimensionsB,
      },
      pixelsDifferent,
      totalPixels,
      details,
    };

    const overallEndTime = performance.now();
    const overallDuration = overallEndTime - overallStartTime;

    logger.log("[imageComparison] 🎉 Comparison complete", {
      result,
      totalDurationMs: overallDuration.toFixed(2),
    });

    return result;
  } catch (error) {
    logger.error("[imageComparison] ❌ Comparison failed with error", {
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error(`Image comparison failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};

/**
 * Count the number of differing bits between two bytes using XOR
 *
 * This function uses bitwise XOR to identify differing bits, then counts
 * the number of set bits in the result. This provides accurate bit-level
 * comparison for verifying lossless encryption.
 *
 * @param byteA - First byte (0-255)
 * @param byteB - Second byte (0-255)
 * @returns Number of bits that differ (0-8)
 */
function countDifferingBits(byteA: number, byteB: number): number {
  const xor = byteA ^ byteB;
  let count = 0;
  let value = xor;

  // Count set bits in XOR result
  while (value > 0) {
    count += value & 1;
    value >>= 1;
  }

  return count;
}

/**
 * Compare two images at the bit level (bit-by-bit comparison)
 *
 * LOSSLESS ENCRYPTION VERIFICATION: This function performs a complete bit-by-bit
 * comparison of two files, ensuring 100% accuracy verification. Unlike pixel-based
 * comparison (which is lossy due to Canvas conversion), this method compares the
 * raw file bits including headers, metadata, and all pixel data.
 *
 * When used to verify encryption/decryption:
 * - Original file vs. Decrypted file should show 100% match (identical: true)
 * - Any difference indicates incorrect key, IV, or encryption mode
 * - Comparison includes ALL file data, not just visible pixels
 *
 * @param imageAUrl - Blob URL or data URL of the first image
 * @param imageBUrl - Blob URL or data URL of the second image
 * @returns Promise resolving to bit-level comparison result with exact bit difference count
 */
export async function compareImageBits(imageAUrl: string, imageBUrl: string): Promise<BitComparisonResult> {
  logger.log("[imageComparison] 🚀 Starting bit-level comparison", {
    imageAUrlLength: imageAUrl.length,
    imageBUrlLength: imageBUrl.length,
  });

  const startTime = performance.now();

  try {
    // Fetch both files
    const [responseA, responseB] = await Promise.all([fetch(imageAUrl), fetch(imageBUrl)]);

    const [blobA, blobB] = await Promise.all([responseA.blob(), responseB.blob()]);

    const [bufferA, bufferB] = await Promise.all([blobA.arrayBuffer(), blobB.arrayBuffer()]);

    const bytesA = new Uint8Array(bufferA);
    const bytesB = new Uint8Array(bufferB);

    logger.log("[imageComparison] 📊 Files loaded", {
      sizeA: bytesA.length,
      sizeB: bytesB.length,
    });

    // Check size mismatch
    if (bytesA.length !== bytesB.length) {
      const totalBitsA = bytesA.length * 8;
      const totalBitsB = bytesB.length * 8;
      const result: BitComparisonResult = {
        identical: false,
        differenceCount: Math.abs(totalBitsA - totalBitsB),
        totalBits: Math.max(totalBitsA, totalBitsB),
        differencePercentage: 100,
        sizeMismatch: true,
        details: `File sizes differ: ${String(bytesA.length)} vs ${String(bytesB.length)} bytes (${String(totalBitsA)} vs ${String(totalBitsB)} bits)`,
      };

      logger.log("[imageComparison] ⚠️ Size mismatch detected", result);
      return result;
    }

    // Bit-by-bit comparison
    let differingBits = 0;
    for (let i = 0; i < bytesA.length; i++) {
      if (bytesA[i] !== bytesB[i]) {
        differingBits += countDifferingBits(bytesA[i], bytesB[i]);
      }
    }

    const totalBits = bytesA.length * 8;
    const identical = differingBits === 0;
    const differencePercentage = (differingBits / totalBits) * 100;

    const result: BitComparisonResult = {
      identical,
      differenceCount: differingBits,
      totalBits,
      differencePercentage,
      sizeMismatch: false,
      details: identical
        ? "Files are identical (100% bit-perfect match)"
        : `${String(differingBits)} bits differ out of ${String(totalBits)} total bits (${differencePercentage.toFixed(4)}% difference)`,
    };

    const endTime = performance.now();
    const duration = endTime - startTime;

    logger.log("[imageComparison] ✅ Bit-level comparison complete", {
      result,
      durationMs: duration.toFixed(2),
    });

    return result;
  } catch (error) {
    logger.error("[imageComparison] ❌ Bit-level comparison failed", {
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error(`Bit-level comparison failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
