import * as React from "react";
import { GitCompare, Lock } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useScreenReaderAnnouncement } from "@/hooks/useScreenReaderAnnouncement";
import { MethodSelector } from "@/components/shared/MethodSelector";
import { KeyInputSection } from "@/components/shared/KeyInputSection";
import { ImageUploadZone } from "@/components/shared/ImageUploadZone";
import { CompactFileInput } from "@/components/shared/CompactFileInput";
import { ImageOutputDisplay } from "@/components/shared/ImageOutputDisplay";
import { DownloadButton } from "@/components/shared/DownloadButton";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ComparisonResult } from "@/components/shared/ComparisonResult";
import { createImageBlobUrl } from "@/utils/imageProcessor";
import { hexToBytes } from "@/utils/hexUtils";
import { downloadImage, generateFilename } from "@/utils/downloadHelper";
import { compareImageBits } from "@/utils/imageComparison";
import { generateCacheKey } from "@/utils/cacheKeyGenerator";
import { cn } from "@/lib/utils";
import type { WorkerMessage } from "@/types/crypto.types";
import type { EncryptionMethod, DecryptedResult } from "@/types/store.types";
import { logger } from "@/utils/logger";

/**
 * Create SVG error placeholder for failed decryption
 *
 * Generates an SVG image with the error message displayed in red text
 * on a neutral gray background that works in both light and dark modes.
 *
 * @param errorMessage - The error message to display
 * @param width - Image width (default 400)
 * @param height - Image height (default 300)
 * @returns Data URL of SVG error placeholder
 */
function createDecryptionErrorSvg(errorMessage: string, width = 400, height = 300): string {
  // Escape special characters for SVG
  const escapedMessage = errorMessage
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // Split message into lines for better display (max ~40 chars per line)
  const words = escapedMessage.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  
  for (const word of words) {
    if ((currentLine + " " + word).length > 40) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Generate text elements for each line
  const lineHeight = 24;
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
  const textElements = lines
    .map(
      (line, index) => `
      <text 
        x="50%" 
        y="${String(startY + index * lineHeight)}" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="14" 
        fill="#dc2626" 
        text-anchor="middle"
        dominant-baseline="middle"
      >${line}</text>`
    )
    .join("");

  const svg = `
    <svg width="${String(width)}" height="${String(height)}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#374151"/>
      <text 
        x="50%" 
        y="${String(startY - 40)}" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="32" 
        fill="#ef4444" 
        text-anchor="middle"
        dominant-baseline="middle"
      >⚠️</text>
      ${textElements}
    </svg>
  `;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  return URL.createObjectURL(blob);
}

/**
 * Process decrypted bits and return the final bits and MIME type
 * 
 * PRESERVE PATTERN SUPPORT: If a BMP header was stored during loading,
 * recombines it with the decrypted body to reconstruct the complete BMP file.
 */
function processDecryptedBits(
  bits: Uint8Array,
  mimeType: string
): { finalBits: Uint8Array; finalMimeType: string } {
  // Check if we have a BMP header stored (preserve-pattern decryption)
  const bmpHeader = (window as unknown as { bmpHeaderForDecryption?: Uint8Array }).bmpHeaderForDecryption;
  let finalBits = bits;
  let finalMimeType = mimeType;
  
  if (bmpHeader) {
    logger.log("[DecryptionMode] Recombining BMP header with decrypted body");
    
    // Combine header and decrypted body
    const totalSize = bmpHeader.length + bits.length;
    finalBits = new Uint8Array(totalSize);
    finalBits.set(bmpHeader, 0);
    finalBits.set(bits, bmpHeader.length);
    
    // Update file size in BMP header (bytes 2-5, little-endian)
    finalBits[2] = totalSize & 0xff;
    finalBits[3] = (totalSize >> 8) & 0xff;
    finalBits[4] = (totalSize >> 16) & 0xff;
    finalBits[5] = (totalSize >> 24) & 0xff;
    
    logger.log("[DecryptionMode] BMP file reconstructed", {
      headerSize: bmpHeader.length,
      bodySize: bits.length,
      totalSize,
    });
    
    // Clean up stored header
    delete (window as unknown as { bmpHeaderForDecryption?: Uint8Array }).bmpHeaderForDecryption;
    
    // Force BMP MIME type for preserve-pattern decryption
    finalMimeType = "image/bmp";
  }
  
  return { finalBits, finalMimeType };
}

/**
 * Handle successful decryption result
 *
 * LOSSLESS DECRYPTION: After decryption, the recovered bits are used to
 * create a Blob URL with the original MIME type (from stored metadata).
 * This ensures the browser correctly interprets the file format, and the
 * result is bit-identical to the original file before encryption.
 * 
 * The result is cached in the store for the current method.
 */
function handleDecryptionSuccess(
  bits: Uint8Array,
  mimeType: string,
  method: EncryptionMethod,
  updateCacheResult: (method: EncryptionMethod, result: DecryptedResult) => void,
  setDecryptionProcessing: (processing: boolean) => void,
  announce: (message: string, priority: "polite" | "assertive") => void,
  setShowSuccess: (show: boolean) => void
) {
  logger.log("[DecryptionMode] Creating blob from decrypted bits");
  
  const { finalBits, finalMimeType } = processDecryptedBits(bits, mimeType);
  
  const url = createImageBlobUrl(finalBits, finalMimeType);
  logger.log("[DecryptionMode] Storing decrypted result in cache", { method, url });
  
  // Store result in cache
  updateCacheResult(method, {
    decryptedImage: url,
    decryptedBits: finalBits,
    timestamp: Date.now(),
  });
  logger.log("[DecryptionMode] Result stored in cache successfully");
  
  logger.log("[DecryptionMode] Setting processing to false");
  setDecryptionProcessing(false);

  announce("Decryption complete, image ready for download", "polite");

  setShowSuccess(true);
  setTimeout(() => {
    setShowSuccess(false);
  }, 2000);
  logger.log("[DecryptionMode] Decryption complete!");
}

/**
 * Handle decryption error
 */
function handleDecryptionError(
  error: unknown,
  setDecryptionError: (error: string | null) => void,
  setDecryptionProcessing: (processing: boolean) => void
) {
  logger.error("[DecryptionMode] Error creating blob", error);
  setDecryptionError(error instanceof Error ? error.message : "Failed to create decrypted image");
  setDecryptionProcessing(false);
}

interface WorkerMessageHandlerParams {
  message: WorkerMessage;
  mimeType: string;
  method: EncryptionMethod;
  updateCacheResult: (method: EncryptionMethod, result: DecryptedResult) => void;
  setDecryptionError: (error: string | null) => void;
  setDecryptionProcessing: (processing: boolean) => void;
  announce: (message: string, priority: "polite" | "assertive") => void;
  setShowSuccess: (show: boolean) => void;
}

/**
 * Handle result message from worker
 */
function handleResultMessage(params: WorkerMessageHandlerParams) {
  const {
    message,
    mimeType,
    method,
    updateCacheResult,
    setDecryptionError,
    setDecryptionProcessing,
    announce,
    setShowSuccess,
  } = params;

  logger.log("[DecryptionMode] Processing RESULT message", { bitsLength: message.payload?.bits?.length });

  if (!message.payload?.bits) {
    return;
  }

  try {
    handleDecryptionSuccess(
      message.payload.bits,
      mimeType,
      method,
      updateCacheResult,
      setDecryptionProcessing,
      announce,
      setShowSuccess
    );
  } catch (error) {
    handleDecryptionError(error, setDecryptionError, setDecryptionProcessing);
  }
}

/**
 * Handle error message from worker
 * 
 * Creates an error SVG placeholder and saves it to the cache so the error
 * is visually displayed in the output area.
 */
function handleErrorMessage(
  message: WorkerMessage,
  method: EncryptionMethod,
  updateCacheResult: (method: EncryptionMethod, result: DecryptedResult) => void,
  setDecryptionError: (error: string | null) => void,
  setDecryptionProcessing: (processing: boolean) => void
) {
  const workerError = message.payload?.error;
  const guidanceMessage = "Verify that the key, IV, and encryption mode match those used during encryption.";
  
  // Build full error message: worker error + guidance, or just guidance if no worker error
  const fullErrorMessage = workerError 
    ? `${workerError}. ${guidanceMessage}`
    : `Decryption failed. ${guidanceMessage}`;
  
  logger.error("[DecryptionMode] Received ERROR from worker", fullErrorMessage);
  
  // Create error SVG with full message and save to cache so it displays in output
  const errorSvgUrl = createDecryptionErrorSvg(fullErrorMessage);
  updateCacheResult(method, {
    decryptedImage: errorSvgUrl,
    decryptedBits: new Uint8Array(0), // Empty bits for error state
    timestamp: Date.now(),
  });
  
  setDecryptionError(fullErrorMessage);
  setDecryptionProcessing(false);
}

/**
 * Handle worker message
 */
function handleWorkerMessage(params: WorkerMessageHandlerParams) {
  const { message, method, updateCacheResult, setDecryptionError, setDecryptionProcessing } = params;

  logger.log("[DecryptionMode] Received message from worker", message.type);

  if (message.type === "RESULT" && message.payload?.bits) {
    handleResultMessage(params);
  } else if (message.type === "ERROR") {
    handleErrorMessage(message, method, updateCacheResult, setDecryptionError, setDecryptionProcessing);
  }
}

/**
 * Validate encrypted data size for block cipher modes
 *
 * BLOCK CIPHER REQUIREMENT: ECB and CBC modes require data to be aligned
 * to 16-byte blocks (AES block size). CTR mode is a stream cipher and
 * doesn't have this requirement. This validation catches corrupted or
 * incorrectly encrypted files early.
 */
function validateEncryptedDataSize(method: string, encryptedBits: Uint8Array) {
  const requiresBlockAlignment = method === "ECB" || method === "CBC";
  const isValidSize = encryptedBits.length % 16 === 0;

  if (requiresBlockAlignment && !isValidSize) {
    logger.error("[DecryptionMode] Encrypted data size is not a multiple of 16", {
      dataSize: encryptedBits.length,
      remainder: encryptedBits.length % 16,
    });
    throw new Error(
      `Invalid encrypted data: size must be multiple of 16 bytes for ${method} mode, but got ${String(encryptedBits.length)} bytes`
    );
  }
}

/**
 * Check if data is a BMP file by examining the header
 * 
 * BMP files start with 'BM' signature (0x42 0x4D).
 * This is used to detect preserve-pattern encrypted files, which are
 * BMP files with encrypted pixel data but intact headers.
 * 
 * @param data - The file data to check
 * @returns True if the file is a BMP file
 */
function isBmpFile(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === 0x42 && data[1] === 0x4d;
}

/**
 * Split BMP file into header and body for preserve-pattern decryption
 * BMP header is always 54 bytes
 */
function splitBmpForDecryption(data: Uint8Array): { header: Uint8Array; body: Uint8Array } {
  const BMP_HEADER_SIZE = 54;
  if (data.length < BMP_HEADER_SIZE) {
    throw new Error("Invalid BMP file: too small");
  }
  
  const header = data.slice(0, BMP_HEADER_SIZE);
  const body = data.slice(BMP_HEADER_SIZE);
  
  logger.log("[DecryptionMode] Split BMP file", {
    headerSize: header.length,
    bodySize: body.length,
    totalSize: data.length,
  });
  
  return { header, body };
}

/**
 * Prepare encrypted bits for decryption
 *
 * LOSSLESS DECRYPTION: Validates the data size for block cipher modes
 * and prepares it for decryption. 
 * 
 * PRESERVE PATTERN SUPPORT: If the file is a BMP (preserve-pattern encryption),
 * splits it into header and body, then decrypts only the body (pixel data).
 * The header is stored separately and will be recombined after decryption.
 */
function prepareEncryptedBitsForDecryption(encryptedBits: Uint8Array, method: string): Uint8Array {
  logger.log("[DecryptionMode] Preparing encrypted bits for decryption", { 
    size: encryptedBits.length,
    firstBytes: Array.from(encryptedBits.slice(0, 4)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
  });

  // Check if this is a BMP file (preserve-pattern encryption)
  const isBmp = isBmpFile(encryptedBits);
  logger.log("[DecryptionMode] BMP detection result", { 
    isBmp,
    byte0: encryptedBits[0],
    byte1: encryptedBits[1],
    expectedByte0: 0x42,
    expectedByte1: 0x4d,
  });
  
  if (isBmp) {
    logger.log("[DecryptionMode] Detected BMP file - using preserve-pattern decryption");
    const { header, body } = splitBmpForDecryption(encryptedBits);
    
    // Store header for later recombination
    (window as unknown as { bmpHeaderForDecryption?: Uint8Array }).bmpHeaderForDecryption = header;
    
    // Validate and return only the body for decryption
    validateEncryptedDataSize(method, body);
    return body;
  }

  // Whole-file encryption - decrypt entire file
  logger.log("[DecryptionMode] Using whole-file decryption");
  validateEncryptedDataSize(method, encryptedBits);
  return encryptedBits;
}

interface DecryptionParams {
  worker: Worker | null;
  encryptedBits: Uint8Array;
  key: string;
  method: "ECB" | "CBC" | "CTR";
  iv: string | undefined;
}

/**
 * Send decryption request to worker
 *
 * WORKER-BASED DECRYPTION: Decryption is performed in a Web Worker to
 * avoid blocking the main thread. The worker receives the encrypted bits,
 * key, IV, and mode, then returns the decrypted bits which are bit-identical
 * to the original file.
 */
function sendDecryptionToWorker(params: DecryptionParams) {
  const { worker, encryptedBits, key, method, iv } = params;

  if (!worker) {
    logger.error("[DecryptionMode] Worker is null!");
    return;
  }

  const keyBytes = hexToBytes(key);
  const ivBytes = iv ? hexToBytes(iv) : undefined;
  logger.log("[DecryptionMode] Converted key and IV", { keyLength: keyBytes.length, ivLength: ivBytes?.length });
  logger.log("[DecryptionMode] Posting message to worker", { method, dataSize: encryptedBits.length });

  const message: WorkerMessage = {
    type: "DECRYPT",
    payload: {
      bits: encryptedBits,
      key: keyBytes,
      mode: method,
      iv: ivBytes,
    },
  };
  worker.postMessage(message);
  logger.log("[DecryptionMode] Message posted to worker");
}

export const DecryptionMode = React.forwardRef<HTMLDivElement>((_, ref) => {
  const {
    decryption,
    setDecryptionMethod,
    setDecryptionKey,
    setDecryptionKeySize,
    setDecryptionIV,
    setEncryptedImageForDecryption,
    setEncryptedBitsForDecryption,
    setDecryptionProcessing,
    setDecryptionError,
    setDecryptionCache,
    updateDecryptionCacheResult,
    updateDecryptionCacheComparison,
  } = useAppStore();

  // Derive current decrypted result from cache (reactive to decryption state changes)
  const currentDecryptedResult = React.useMemo(() => {
    const result = decryption.currentCache?.results[decryption.method];
    logger.log("[DecryptionMode] Current decrypted result derived", {
      method: decryption.method,
      hasResult: !!result,
      url: result?.decryptedImage,
      cacheKey: decryption.currentCache?.cacheKey,
    });
    return result;
  }, [decryption.currentCache, decryption.method]);

  // Derive current decrypted image URL from cache for convenience
  const currentDecryptedImage = currentDecryptedResult?.decryptedImage || null;

  // Derive current comparison result from cache (reactive to method changes)
  const currentCachedComparison = React.useMemo(() => {
    const comparison = decryption.currentCache?.comparisons?.[decryption.method];
    logger.log("[DecryptionMode] Current cached comparison derived", {
      method: decryption.method,
      hasComparison: !!comparison,
      identical: comparison?.result?.identical,
    });
    return comparison;
  }, [decryption.currentCache, decryption.method]);

  const { announce } = useScreenReaderAnnouncement();
  const workerRef = React.useRef<Worker | null>(null);
  const [encryptedFileName, setEncryptedFileName] = React.useState<string>("");
  const [uploadedFileStats, setUploadedFileStats] = React.useState<{ size: number; type: string } | null>(null);
  const decryptionAttemptedRef = React.useRef<string | null>(null);

  const [showSuccess, setShowSuccess] = React.useState(false);

  // Comparison state - local state for UI, cached results in store
  const [comparisonImage, setComparisonImage] = React.useState<string | null>(null);
  const [comparisonFileName, setComparisonFileName] = React.useState<string>("");
  const [comparisonImageHash, setComparisonImageHash] = React.useState<string>("");
  const [isComparing, setIsComparing] = React.useState(false);
  const [comparisonError, setComparisonError] = React.useState<string | null>(null);
  const [showCompareSection, setShowCompareSection] = React.useState(false);

  // Derive comparison result from cache - only show if hash matches current comparison image
  const comparisonResult = React.useMemo(() => {
    if (!currentCachedComparison || !comparisonImageHash) return null;
    // Only return cached result if it was computed with the same comparison image
    if (currentCachedComparison.comparisonImageHash !== comparisonImageHash) {
      logger.log("[DecryptionMode] Cached comparison hash mismatch, will recompute", {
        cachedHash: currentCachedComparison.comparisonImageHash,
        currentHash: comparisonImageHash,
      });
      return null;
    }
    return currentCachedComparison.result;
  }, [currentCachedComparison, comparisonImageHash]);

  const shouldAttemptDecryption = React.useCallback(
    (
      encryptedBits: Uint8Array | null,
      key: string | null,
      isProcessing: boolean,
      currentCache: typeof decryption.currentCache,
      method: EncryptionMethod
    ): encryptedBits is Uint8Array => {
      if (!encryptedBits || !key || isProcessing) {
        return false;
      }

      const cachedResult = currentCache?.results[method];
      if (cachedResult) {
        logger.log("[DecryptionMode] Result found in cache, skipping decryption", { method });
        return false;
      }

      return true;
    },
    [decryption]
  );

  const validateIVRequirement = React.useCallback((method: EncryptionMethod, iv: string): boolean => {
    const needsIV = method === "CBC" || method === "CTR";
    if (needsIV && !iv) {
      logger.log("[DecryptionMode] IV needed but not available, skipping decryption");
      return false;
    }
    return true;
  }, []);

  const isDuplicateAttempt = React.useCallback(
    (attemptKey: string): boolean => {
      if (decryptionAttemptedRef.current === attemptKey) {
        logger.log("[DecryptionMode] Already attempted decryption with these inputs, skipping");
        return true;
      }
      return false;
    },
    []
  );

  const executeDecryption = React.useCallback(
    (
      encryptedBits: Uint8Array,
      key: string,
      method: EncryptionMethod,
      iv: string
    ) => {
      logger.log("[DecryptionMode] Starting decryption process", { method });
      setDecryptionProcessing(true);
      setDecryptionError(null);

      try {
        // Prepare encrypted bits (handles BMP detection for preserve-pattern)
        const bitsToDecrypt = prepareEncryptedBitsForDecryption(encryptedBits, method);
        
        sendDecryptionToWorker({
          worker: workerRef.current,
          encryptedBits: bitsToDecrypt,
          key,
          method,
          iv: iv || undefined,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Decryption failed";
        logger.error("[DecryptionMode] Error during decryption setup", error);
        
        // Create error SVG and save to cache so it displays in output
        const errorSvgUrl = createDecryptionErrorSvg(errorMessage);
        updateDecryptionCacheResult(method, {
          decryptedImage: errorSvgUrl,
          decryptedBits: new Uint8Array(0),
          timestamp: Date.now(),
        });
        
        setDecryptionError(errorMessage);
        setDecryptionProcessing(false);
      }
    },
    [setDecryptionProcessing, setDecryptionError, updateDecryptionCacheResult]
  );

  // Announce processing state changes
  React.useEffect(() => {
    if (decryption.isProcessing) {
      announce("Decrypting image, please wait", "polite");
    }
  }, [decryption.isProcessing, announce]);

  // Announce errors
  React.useEffect(() => {
    if (decryption.error) {
      announce(`Error: ${decryption.error}`, "assertive");
    }
  }, [decryption.error, announce]);

  // Initialize worker once on mount
  React.useEffect(() => {
    logger.log("[DecryptionMode] Initializing worker");
    workerRef.current = new Worker(new URL("../../workers/crypto.worker.ts", import.meta.url), { type: "module" });

    workerRef.current.onmessage = (event: MessageEvent<WorkerMessage>) => {
      // Use stored metadata MIME type, fallback to image/png
      const mimeType = decryption.metadata?.mimeType || "image/png";
      handleWorkerMessage({
        message: event.data,
        mimeType,
        method: decryption.method,
        updateCacheResult: updateDecryptionCacheResult,
        setDecryptionError,
        setDecryptionProcessing,
        announce,
        setShowSuccess,
      });
    };

    workerRef.current.onerror = error => {
      logger.error("[DecryptionMode] Worker error", error);
      setDecryptionError("Worker error occurred");
      setDecryptionProcessing(false);
    };

    return () => {
      logger.log("[DecryptionMode] Terminating worker");
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [decryption.metadata, decryption.method, updateDecryptionCacheResult, setDecryptionError, setDecryptionProcessing, announce]);

  // Track previous URLs for cleanup
  const prevEncryptedImageRef = React.useRef<string | null>(null);
  const prevCacheRef = React.useRef<typeof decryption.currentCache>(null);

  // Cleanup old object URLs when they change
  React.useEffect(() => {
    // Revoke previous encrypted image URL if it changed
    if (prevEncryptedImageRef.current && prevEncryptedImageRef.current !== decryption.encryptedImage) {
      URL.revokeObjectURL(prevEncryptedImageRef.current);
    }
    prevEncryptedImageRef.current = decryption.encryptedImage;

    // Cleanup on unmount
    return () => {
      if (decryption.encryptedImage) {
        URL.revokeObjectURL(decryption.encryptedImage);
      }
    };
  }, [decryption.encryptedImage]);

  // Cleanup decrypted image URLs from cache when cache is completely replaced (different key/IV/image)
  React.useEffect(() => {
    const prevCache = prevCacheRef.current;
    const currentCache = decryption.currentCache;

    logger.log("[DecryptionMode] Cache cleanup effect triggered", {
      hasPrevCache: !!prevCache,
      hasCurrentCache: !!currentCache,
      prevCacheKey: prevCache?.cacheKey,
      currentCacheKey: currentCache?.cacheKey,
    });

    // Only revoke URLs if the cache key changed (different image/key/IV) or cache was cleared
    // Don't revoke when cache is just updated with new results (same cache key)
    const cacheKeyChanged = prevCache && currentCache && prevCache.cacheKey !== currentCache.cacheKey;
    const cacheCleared = prevCache && !currentCache;

    if (cacheKeyChanged || cacheCleared) {
      logger.log("[DecryptionMode] Revoking URLs from previous cache", {
        reason: cacheKeyChanged ? "cache key changed" : "cache cleared",
      });
      const allResults = Object.values(prevCache.results)
        .filter((result): result is NonNullable<typeof result> => Boolean(result));
      allResults.forEach(result => {
        logger.log("[DecryptionMode] Revoking URL", result.decryptedImage);
        URL.revokeObjectURL(result.decryptedImage);
      });
    } else {
      logger.log("[DecryptionMode] Not revoking URLs - cache updated with same key");
    }

    prevCacheRef.current = currentCache;
  }, [decryption.currentCache]);

  // Cleanup all URLs only on component unmount (not on re-renders)
  React.useEffect(() => {
    return () => {
      logger.log("[DecryptionMode] Component unmounting - revoking all cached URLs");
      const cache = prevCacheRef.current;
      if (cache) {
        const allResults = Object.values(cache.results)
          .filter((result): result is NonNullable<typeof result> => Boolean(result));
        allResults.forEach(result => {
          logger.log("[DecryptionMode] Revoking URL on unmount", result.decryptedImage);
          URL.revokeObjectURL(result.decryptedImage);
        });
      }
    };
  }, []); // Empty deps - only runs on mount/unmount

  // Auto-execute decryption when encrypted bits and key are ready
  React.useEffect(() => {
    const { encryptedBits, key, method, isProcessing, iv, currentCache } = decryption;

    if (!shouldAttemptDecryption(encryptedBits, key, isProcessing, currentCache, method)) {
      return;
    }

    // If cache is null but we have encryptedBits and key, we need to initialize the cache first
    if (!currentCache) {
      logger.log("[DecryptionMode] Cache is null, initializing before decryption");
      
      // Initialize cache asynchronously and let the next effect run handle decryption
      void generateCacheKey(key + iv, encryptedBits).then(cacheKey => {
        setDecryptionCache({
          cacheKey,
          results: {},
          comparisons: {},
        });
        logger.log("[DecryptionMode] Cache initialized from auto-execute effect", { cacheKey });
      }).catch((error: unknown) => {
        logger.error("[DecryptionMode] Failed to generate cache key", error);
        setDecryptionError("Failed to initialize decryption cache");
      });
      return;
    }

    if (!validateIVRequirement(method, iv)) {
      return;
    }

    const attemptKey = `${String(encryptedBits.length)}|${key}|${method}|${iv}`;
    if (isDuplicateAttempt(attemptKey)) {
      return;
    }

    decryptionAttemptedRef.current = attemptKey;

    executeDecryption(encryptedBits, key, method, iv);
  }, [
    decryption,
    setDecryptionProcessing,
    setDecryptionError,
    setDecryptionCache,
    shouldAttemptDecryption,
    validateIVRequirement,
    isDuplicateAttempt,
    executeDecryption,
  ]);

  /**
   * Handle encrypted file upload
   *
   * LOSSLESS DECRYPTION WORKFLOW:
   * 1. Read encrypted file as raw bits (no format assumptions)
   * 2. Store bits for decryption
   * 3. Initialize decryption cache
   * 4. Decryption will use stored metadata to reconstruct original format
   * 5. Result will be bit-identical to original file
   *
   * The encrypted file contains the complete encrypted data including
   * all headers and metadata from the original file.
   */
  const handleEncryptedFileUpload = React.useCallback(
    async (file: File) => {
      try {
        decryptionAttemptedRef.current = null; // Reset attempt tracking
        setDecryptionError(null);
        setDecryptionCache(null); // Clear cache when new file is uploaded
        setEncryptedFileName(file.name);
        setUploadedFileStats({ size: file.size, type: file.type });

        // Read encrypted file as raw bits (complete encrypted data)
        const arrayBuffer = await file.arrayBuffer();
        const encryptedBits = new Uint8Array(arrayBuffer);

        // Create Blob URL for display
        const blob = new Blob([encryptedBits.buffer], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);

        // Store the encrypted bits for decryption
        setEncryptedBitsForDecryption(encryptedBits);
        setEncryptedImageForDecryption(url);

        // Initialize cache if we have a key
        if (decryption.key) {
          const cacheKey = await generateCacheKey(decryption.key + decryption.iv, encryptedBits);
          setDecryptionCache({
            cacheKey,
            results: {},
            comparisons: {},
          });
          logger.log("[DecryptionMode] Cache initialized from file upload", { cacheKey });
        }
      } catch (error) {
        setDecryptionError(error instanceof Error ? error.message : "Failed to process encrypted file");
      }
    },
    [decryption.key, decryption.iv, setEncryptedImageForDecryption, setEncryptedBitsForDecryption, setDecryptionCache, setDecryptionError]
  );

  // Handle image removal
  const handleRemoveImage = React.useCallback(() => {
    if (decryption.encryptedImage) {
      URL.revokeObjectURL(decryption.encryptedImage);
    }
    // Revoke all cached decrypted image URLs
    if (decryption.currentCache) {
      const allResults = Object.values(decryption.currentCache.results)
        .filter((result): result is NonNullable<typeof result> => Boolean(result));
      allResults.forEach(result => {
        URL.revokeObjectURL(result.decryptedImage);
      });
    }
    setEncryptedImageForDecryption(null);
    setEncryptedBitsForDecryption(null);
    setDecryptionCache(null);
    setEncryptedFileName("");
    setUploadedFileStats(null);
  }, [decryption.encryptedImage, decryption.currentCache, setEncryptedImageForDecryption, setEncryptedBitsForDecryption, setDecryptionCache]);

  // Handle download decrypted image
  const handleDownloadImage = React.useCallback(() => {
    if (!currentDecryptedImage) return;

    // Use stored metadata for filename, or fallback to encrypted filename
    const originalFilename = decryption.metadata?.filename || encryptedFileName;
    const baseFilename = originalFilename.replace(/\.[^/.]+$/, "");

    // Get file extension from metadata MIME type, or fallback to png
    const mimeType = decryption.metadata?.mimeType || "image/png";
    const extension = mimeType.split("/")[1] || "png";

    const filename = generateFilename(`decrypted-${baseFilename}`, extension);
    downloadImage(currentDecryptedImage, filename);
  }, [currentDecryptedImage, decryption.metadata, encryptedFileName]);

  // Handle comparison image upload
  const handleComparisonImageUpload = React.useCallback(async (file: File) => {
    try {
      setComparisonError(null);
      // Clear cached comparison for current method when new comparison image is uploaded
      if (decryption.method) {
        updateDecryptionCacheComparison(decryption.method, null);
      }
      setComparisonFileName(file.name);

      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: file.type });
      const url = URL.createObjectURL(blob);

      // Generate hash for tracking this comparison image
      const newHash = `${url}:${file.name}`;
      setComparisonImageHash(newHash);
      setComparisonImage(url);
    } catch (error) {
      setComparisonError(error instanceof Error ? error.message : "Failed to process comparison image");
    }
  }, [decryption.method, updateDecryptionCacheComparison]);

  // Handle comparison image removal
  const handleRemoveComparisonImage = React.useCallback(() => {
    if (comparisonImage) {
      URL.revokeObjectURL(comparisonImage);
    }
    setComparisonImage(null);
    setComparisonFileName("");
    setComparisonImageHash("");
    // Clear all cached comparisons when comparison image is removed
    if (decryption.currentCache) {
      const methods: EncryptionMethod[] = ["ECB", "CBC", "CTR"];
      methods.forEach(method => {
        updateDecryptionCacheComparison(method, null);
      });
    }
    setComparisonError(null);
  }, [comparisonImage, decryption.currentCache, updateDecryptionCacheComparison]);

  // Handle compare action
  const handleCompare = React.useCallback(async () => {
    if (!currentDecryptedImage || !comparisonImage || !comparisonImageHash) {
      setComparisonError("Please upload an image to compare");
      return;
    }

    setIsComparing(true);
    setComparisonError(null);

    try {
      const result = await compareImageBits(currentDecryptedImage, comparisonImage);
      
      // Store comparison result in cache using the current hash from state
      updateDecryptionCacheComparison(decryption.method, {
        comparisonImageHash,
        result,
        timestamp: Date.now(),
      });
      
      announce(
        result.identical
          ? "Images are identical (100% bit-perfect match)"
          : `Images differ by ${result.differencePercentage.toFixed(4)}%`,
        "polite"
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Image comparison failed. Please try again";
      setComparisonError(errorMessage);
      announce(`Error: ${errorMessage}`, "assertive");
    } finally {
      setIsComparing(false);
    }
  }, [currentDecryptedImage, comparisonImage, comparisonImageHash, decryption.method, updateDecryptionCacheComparison, announce]);

  // Auto-compare when both images are ready and no cached result exists
  React.useEffect(() => {
    if (currentDecryptedImage && comparisonImage && !isComparing && !comparisonResult) {
      void handleCompare();
    }
  }, [currentDecryptedImage, comparisonImage, isComparing, comparisonResult, handleCompare]);

  // Cleanup comparison image URL on unmount
  React.useEffect(() => {
    return () => {
      if (comparisonImage) {
        URL.revokeObjectURL(comparisonImage);
      }
    };
  }, [comparisonImage]);

  return (
    <div ref={ref} className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl">
      <ErrorAlert
        error={decryption.error}
        onDismiss={() => {
          setDecryptionError(null);
        }}
      />

      {/* Image Input - Full width at top */}
      <div className="mb-4 sm:mb-6 w-full">
        <CompactFileInput
          onFileUpload={file => {
            handleEncryptedFileUpload(file).catch((err: unknown) => {
              setDecryptionError(err instanceof Error ? err.message : "Upload failed");
            });
          }}
          onError={setDecryptionError}
          onRemove={handleRemoveImage}
          disabled={decryption.isProcessing}
          uploadedFileName={encryptedFileName}
          fileSize={uploadedFileStats?.size}
          fileType={uploadedFileStats?.type}
          className="w-full"
          icon={<Lock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
          acceptedFileTypes={[]}
        />
      </div>

      {/* Mobile: single column, Tablet: single column with larger spacing, Desktop: 40/60 split */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 sm:gap-6 lg:gap-8">
        {/* Input Column */}
        <div className="flex flex-col gap-4 sm:gap-6">
          <MethodSelector
            method={decryption.method}
            onMethodChange={method => {
              setDecryptionError(null);
              setDecryptionMethod(method);
            }}
            disabled={decryption.isProcessing}
          />

          <KeyInputSection
            method={decryption.method}
            keyValue={decryption.key}
            ivValue={decryption.iv}
            keySize={decryption.keySize}
            onKeyChange={key => {
              setDecryptionError(null);
              setDecryptionKey(key);
            }}
            onIVChange={iv => {
              setDecryptionError(null);
              setDecryptionIV(iv);
            }}
            onKeySizeChange={keySize => {
              setDecryptionError(null);
              setDecryptionKeySize(keySize);
            }}
            onMethodChange={setDecryptionMethod}
            onError={setDecryptionError}
            disabled={decryption.isProcessing}
            showFileUpload={true}
            showGenerate={false}
            showKeySizeSelector={true}
            className="flex-1"
          />
        </div>

        {/* Output Column */}
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className={cn("transition-all duration-300", showSuccess && "ring-2 ring-green-500 rounded-lg")}>
            <ImageOutputDisplay
              imageUrl={currentDecryptedImage}
              placeholderText="Decrypted image will appear here"
              isLoading={decryption.isProcessing}
              loadingText="Decrypting..."
              height="mobile"
              className="md:hidden"
            />
            <ImageOutputDisplay
              imageUrl={currentDecryptedImage}
              placeholderText="Decrypted image will appear here"
              isLoading={decryption.isProcessing}
              loadingText="Decrypting..."
              height="tablet"
              className="hidden md:block lg:hidden"
            />
            <ImageOutputDisplay
              imageUrl={currentDecryptedImage}
              placeholderText="Decrypted image will appear here"
              isLoading={decryption.isProcessing}
              loadingText="Decrypting..."
              height="desktop"
              className="hidden lg:block"
            />
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <DownloadButton
                variant="image"
                onClick={handleDownloadImage}
                disabled={!currentDecryptedImage || decryption.isProcessing}
                shortcut="d"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCompareSection(!showCompareSection);
                }}
                disabled={!currentDecryptedImage || decryption.isProcessing}
                className="min-h-[44px] px-4 sm:px-3 py-3 sm:py-2"
              >
                <GitCompare className="h-4 w-4 mr-2" />
                <span>{showCompareSection ? "Hide Compare" : "Compare Image"}</span>
              </Button>
            </div>

            {/* Comparison Section */}
            {showCompareSection && currentDecryptedImage && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                {comparisonError && (
                  <ErrorAlert
                    error={comparisonError}
                    onDismiss={() => {
                      setComparisonError(null);
                    }}
                  />
                )}

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Compare with another image
                  </h3>
                  <ImageUploadZone
                    onImageUpload={file => {
                      handleComparisonImageUpload(file).catch((err: unknown) => {
                        setComparisonError(err instanceof Error ? err.message : "Upload failed");
                      });
                    }}
                    onError={setComparisonError}
                    onRemove={handleRemoveComparisonImage}
                    disabled={isComparing}
                    label="Drop comparison image here or click to browse"
                    uploadedFileName={comparisonFileName}
                    previewUrl={comparisonImage || undefined}
                  />
                </div>

                {/* Comparison Result */}
                {comparisonResult && (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <ComparisonResult result={comparisonResult} />
                  </div>
                )}

                {/* Loading State */}
                {isComparing && (
                  <div className="flex items-center justify-center p-6 border-2 border-dashed border-border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-sm text-muted-foreground">Comparing images...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

DecryptionMode.displayName = "DecryptionMode";
