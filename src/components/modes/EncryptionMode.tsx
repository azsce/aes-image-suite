import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { useScreenReaderAnnouncement } from "@/hooks/useScreenReaderAnnouncement";
import { MethodSelector } from "@/components/shared/MethodSelector";
import { KeyInputSection } from "@/components/shared/KeyInputSection";
import { CompactImageInput } from "@/components/shared/CompactImageInput";
import { ImageOutputDisplay } from "@/components/shared/ImageOutputDisplay";
import { DownloadButton } from "@/components/shared/DownloadButton";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { EncryptionApproachSelector } from "@/components/shared/EncryptionApproachSelector";
import { readImageBits, extractImageMetadata, createImageBlobUrl } from "@/utils/imageProcessor";
import { visualizeEncryptedBits } from "@/utils/encryptedImageVisualizer";
import { hexToBytes, generateKey, generateIV } from "@/utils/hexUtils";
import { downloadImage, downloadBundle, generateFilename } from "@/utils/downloadHelper";
import { generateBinaryKeyFile, downloadBinaryFile, Filename } from "@/utils/keyFileHandler";
import { convertFileToBmp, createBmpBlob } from "@/utils/bmpConverter";
import { generateCacheKey } from "@/utils/cacheKeyGenerator";
import { cn } from "@/lib/utils";
import type { WorkerMessage } from "@/types/crypto.types";
import type { EncryptionMethod, EncryptedResult } from "@/types/store.types";
import type { EncryptionMethodType } from "@/types/encryption-method.types";
import { logger } from "@/utils/logger";

/**
 * Handle successful encryption result
 *
 * LOSSLESS ENCRYPTION: After encryption, the encrypted bits are stored and
 * visualized. The visualization shows encryption patterns but the actual
 * encrypted bits remain unchanged and can be decrypted to recover the
 * exact original file.
 *
 * The result is cached in the store for the current method and approach combination.
 */
async function handleEncryptionSuccess(
  encryptedBits: Uint8Array,
  metadata: { mimeType: string; width: number; height: number; filename: string; fileSize: number },
  method: EncryptionMethod,
  approach: EncryptionMethodType,
  keySize: 128 | 192 | 256,
  updateCacheResult: (method: EncryptionMethod, approach: EncryptionMethodType, result: EncryptedResult) => void,
  setEncryptionProcessing: (processing: boolean) => void,
  announce: (message: string, priority: "polite" | "assertive") => void,
  setShowSuccess: (show: boolean) => void
) {
  logger.log("[EncryptionMode] Creating visualization from encrypted bits");

  // Check if we have a BMP header stored (for pixel-data encryption)
  const bmpHeader = (window as unknown as { bmpHeader?: Uint8Array }).bmpHeader;
  let finalBits = encryptedBits;

  if (bmpHeader) {
    logger.log("[EncryptionMode] Combining BMP header with encrypted body");
    const bmpBlob = createBmpBlob(bmpHeader, encryptedBits);
    const bmpBits = new Uint8Array(await bmpBlob.arrayBuffer());
    finalBits = bmpBits;

    // Clean up stored header
    delete (window as unknown as { bmpHeader?: Uint8Array }).bmpHeader;
  }

  // Visualize encrypted bits as an image to show encryption patterns
  logger.log("[EncryptionMode] Creating encrypted bits visualization");
  const url = await visualizeEncryptedBits(finalBits, metadata, { method, keySize });

  // Store result in cache
  logger.log("[EncryptionMode] Storing result in cache", { method, approach, url, urlValid: url.startsWith("blob:") });
  updateCacheResult(method, approach, {
    encryptedImage: url,
    encryptedBits: finalBits,
    timestamp: Date.now(),
  });
  logger.log("[EncryptionMode] Result stored in cache successfully");

  logger.log("[EncryptionMode] Setting processing to false");
  setEncryptionProcessing(false);

  announce("Encryption complete, image ready for download", "polite");

  setShowSuccess(true);
  setTimeout(() => {
    setShowSuccess(false);
  }, 2000);
  logger.log("[EncryptionMode] Encryption complete!");
}

/**
 * Handle encryption error
 */
function handleEncryptionError(
  error: unknown,
  setEncryptionError: (error: string | null) => void,
  setEncryptionProcessing: (processing: boolean) => void
) {
  logger.error("[EncryptionMode] Error creating blob", error);
  setEncryptionError(error instanceof Error ? error.message : "Failed to create encrypted image");
  setEncryptionProcessing(false);
}

interface WorkerMessageHandlerParams {
  message: WorkerMessage;
  metadata: { mimeType: string; width: number; height: number; filename: string; fileSize: number } | null;
  method: EncryptionMethod;
  approach: EncryptionMethodType;
  keySize: 128 | 192 | 256;
  updateCacheResult: (method: EncryptionMethod, approach: EncryptionMethodType, result: EncryptedResult) => void;
  setEncryptionError: (error: string | null) => void;
  setEncryptionProcessing: (processing: boolean) => void;
  announce: (message: string, priority: "polite" | "assertive") => void;
  setShowSuccess: (show: boolean) => void;
}

/**
 * Handle result message from worker
 */
function handleResultMessage(params: WorkerMessageHandlerParams) {
  const {
    message,
    metadata,
    method,
    approach,
    keySize,
    updateCacheResult,
    setEncryptionError,
    setEncryptionProcessing,
    announce,
    setShowSuccess,
  } = params;

  logger.log("[EncryptionMode] Processing RESULT message", { bitsLength: message.payload?.bits?.length });

  if (!message.payload?.bits) {
    logger.error("[EncryptionMode] No encrypted bits in result");
    setEncryptionError("Encryption failed: no result data");
    setEncryptionProcessing(false);
    return;
  }

  if (!metadata) {
    logger.error("[EncryptionMode] No metadata available for visualization");
    setEncryptionError("Cannot visualize encrypted image: metadata missing");
    setEncryptionProcessing(false);
    return;
  }

  handleEncryptionSuccess(
    message.payload.bits,
    metadata,
    method,
    approach,
    keySize,
    updateCacheResult,
    setEncryptionProcessing,
    announce,
    setShowSuccess
  ).catch((error: unknown) => {
    handleEncryptionError(error, setEncryptionError, setEncryptionProcessing);
  });
}

/**
 * Handle error message from worker
 */
function handleErrorMessage(
  message: WorkerMessage,
  setEncryptionError: (error: string | null) => void,
  setEncryptionProcessing: (processing: boolean) => void
) {
  logger.error("[EncryptionMode] Received ERROR from worker", message.payload?.error);
  setEncryptionError(message.payload?.error || "Encryption failed");
  setEncryptionProcessing(false);
}

/**
 * Handle worker message
 */
function handleWorkerMessage(params: WorkerMessageHandlerParams) {
  const { message, setEncryptionError, setEncryptionProcessing } = params;

  logger.log("[EncryptionMode] Received message from worker", message.type);

  if (message.type === "RESULT" && message.payload?.bits) {
    handleResultMessage(params);
  } else if (message.type === "ERROR") {
    handleErrorMessage(message, setEncryptionError, setEncryptionProcessing);
  }
}

export const EncryptionMode = React.forwardRef<HTMLDivElement>((_, ref) => {
  const {
    encryption,
    setEncryptionMethod,
    setEncryptionKey,
    setEncryptionKeySize,
    setOriginalImage,
    setOriginalBits,
    setEncryptionMetadata,
    setEncryptionProcessing,
    setEncryptionError,
    setFileEncryptionMethod,
    setEncryptionCache,
    updateEncryptionCacheResult,
    setCurrentIV,
  } = useAppStore();

  // Derive current encrypted result from cache (reactive to encryption state changes)
  const currentEncryptedResult = React.useMemo(() => {
    const result = encryption.currentCache?.results[encryption.method]?.[encryption.encryptionMethod];
    logger.log("[EncryptionMode] Current encrypted result derived", {
      method: encryption.method,
      approach: encryption.encryptionMethod,
      hasResult: !!result,
      url: result?.encryptedImage,
      cacheKey: encryption.currentCache?.cacheKey,
    });
    return result;
  }, [encryption.currentCache, encryption.method, encryption.encryptionMethod]);

  // Derive current IV from cache (reactive to cache changes)
  const currentIV = React.useMemo(() => {
    return encryption.currentCache?.iv || "";
  }, [encryption.currentCache]);

  const { announce } = useScreenReaderAnnouncement();
  const workerRef = React.useRef<Worker | null>(null);
  const [originalFileName, setOriginalFileName] = React.useState<string>("");
  const encryptionAttemptedRef = React.useRef<string | null>(null);

  const [showSuccess, setShowSuccess] = React.useState(false);

  const shouldAttemptEncryption = React.useCallback(
    (
      originalBits: Uint8Array | null,
      key: string | null,
      isProcessing: boolean,
      currentCache: typeof encryption.currentCache,
      method: EncryptionMethod,
      encryptionMethod: EncryptionMethodType
    ): originalBits is Uint8Array => {
      if (!originalBits || !key || isProcessing) {
        return false;
      }

      const cachedResult = currentCache?.results[method]?.[encryptionMethod];
      if (cachedResult) {
        logger.log("[EncryptionMode] Result found in cache, skipping encryption", { method, encryptionMethod });
        return false;
      }

      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- All values passed as parameters
    []
  );

  const validateIVRequirement = React.useCallback((method: EncryptionMethod, iv: string): boolean => {
    const needsIV = method === "CBC" || method === "CTR";
    if (needsIV && !iv) {
      logger.log("[EncryptionMode] IV needed but not available, skipping encryption");
      return false;
    }
    return true;
  }, []);

  const isDuplicateAttempt = React.useCallback(
    (attemptKey: string): boolean => {
      if (encryptionAttemptedRef.current === attemptKey) {
        logger.log("[EncryptionMode] Already attempted encryption with these inputs, skipping");
        return true;
      }
      return false;
    },
    []
  );

  const preparePixelDataEncryption = React.useCallback(
    async (originalBits: Uint8Array): Promise<Uint8Array> => {
      logger.log("[EncryptionMode] Using pixel-data encryption");

      const arrayBuffer = originalBits.buffer.slice(
        originalBits.byteOffset,
        originalBits.byteOffset + originalBits.byteLength
      ) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: encryption.metadata?.mimeType || "image/png" });
      const file = new File([blob], "temp.img", { type: blob.type });

      try {
        const bmpData = await convertFileToBmp(file);
        logger.log("[EncryptionMode] Converted to BMP", {
          headerSize: bmpData.header.length,
          bodySize: bmpData.body.length,
        });

        (window as unknown as { bmpHeader?: Uint8Array }).bmpHeader = bmpData.header;
        return bmpData.body;
      } catch (error) {
        logger.error("[EncryptionMode] BMP conversion failed, falling back to whole-file", error);
        setEncryptionError("BMP conversion failed. Using whole-file encryption instead.");
        return originalBits;
      }
    },
    [encryption, setEncryptionError]
  );

  const sendToWorker = React.useCallback(
    (bitsToEncrypt: Uint8Array, keyBytes: Uint8Array, method: EncryptionMethod, ivBytes?: Uint8Array) => {
      if (!workerRef.current) {
        logger.error("[EncryptionMode] Worker is null!");
        return;
      }

      logger.log("[EncryptionMode] Posting message to worker", { method, bitsSize: bitsToEncrypt.length });
      const message: WorkerMessage = {
        type: "ENCRYPT",
        payload: {
          bits: bitsToEncrypt,
          key: keyBytes,
          mode: method,
          iv: ivBytes,
        },
      };
      workerRef.current.postMessage(message);
      logger.log("[EncryptionMode] Message posted to worker");
    },
    []
  );

  const executeEncryption = React.useCallback(
    async (
      originalBits: Uint8Array,
      key: string,
      method: EncryptionMethod,
      iv: string,
      encryptionMethod: EncryptionMethodType
    ) => {
      logger.log("[EncryptionMode] Starting encryption process", { encryptionMethod });
      setEncryptionProcessing(true);
      setEncryptionError(null);

      try {
        const bitsToEncrypt =
          encryptionMethod === "pixel-data"
            ? await preparePixelDataEncryption(originalBits)
            : originalBits;

        logger.log("[EncryptionMode] Bits to encrypt", { size: bitsToEncrypt.length });

        const keyBytes = hexToBytes(key);
        const ivBytes = iv ? hexToBytes(iv) : undefined;
        logger.log("[EncryptionMode] Converted key and IV", { keyLength: keyBytes.length, ivLength: ivBytes?.length });

        sendToWorker(bitsToEncrypt, keyBytes, method, ivBytes);
      } catch (error) {
        logger.error("[EncryptionMode] Error during encryption setup", error);
        setEncryptionError(error instanceof Error ? error.message : "Encryption failed");
        setEncryptionProcessing(false);
      }
    },
    [preparePixelDataEncryption, sendToWorker, setEncryptionProcessing, setEncryptionError]
  );

  // Auto-generate IV on mount if method requires it and IV doesn't exist
  React.useEffect(() => {
    const needsIV = encryption.method === "CBC" || encryption.method === "CTR";
    if (needsIV && !currentIV) {
      logger.log("[EncryptionMode] Auto-generating IV for", encryption.method);
      setCurrentIV(generateIV());
    }
  }, [encryption.method, currentIV, setCurrentIV]);

  // Announce processing state changes
  React.useEffect(() => {
    if (encryption.isProcessing) {
      announce("Encrypting image, please wait", "polite");
    }
  }, [encryption.isProcessing, announce]);

  // Announce errors
  React.useEffect(() => {
    if (encryption.error) {
      announce(`Error: ${encryption.error}`, "assertive");
    }
  }, [encryption.error, announce]);

  // Initialize worker once on mount
  React.useEffect(() => {
    logger.log("[EncryptionMode] Initializing worker");
    workerRef.current = new Worker(new URL("../../workers/crypto.worker.ts", import.meta.url), { type: "module" });

    workerRef.current.onmessage = (event: MessageEvent<WorkerMessage>) => {
      handleWorkerMessage({
        message: event.data,
        metadata: encryption.metadata,
        method: encryption.method,
        approach: encryption.encryptionMethod,
        keySize: encryption.keySize,
        updateCacheResult: updateEncryptionCacheResult,
        setEncryptionError,
        setEncryptionProcessing,
        announce,
        setShowSuccess,
      });
    };

    workerRef.current.onerror = error => {
      logger.error("[EncryptionMode] Worker error", error);
      setEncryptionError("Worker error occurred");
      setEncryptionProcessing(false);
    };

    return () => {
      logger.log("[EncryptionMode] Terminating worker");
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [
    encryption.metadata,
    encryption.method,
    encryption.encryptionMethod,
    encryption.keySize,
    updateEncryptionCacheResult,
    setEncryptionError,
    setEncryptionProcessing,
    announce,
  ]);

  // Track previous URLs for cleanup
  const prevOriginalImageRef = React.useRef<string | null>(null);
  const prevCacheRef = React.useRef<typeof encryption.currentCache>(null);

  // Cleanup old object URLs when they change
  React.useEffect(() => {
    // Revoke previous original image URL if it changed
    if (prevOriginalImageRef.current && prevOriginalImageRef.current !== encryption.originalImage) {
      URL.revokeObjectURL(prevOriginalImageRef.current);
    }
    prevOriginalImageRef.current = encryption.originalImage;

    // Cleanup on unmount
    return () => {
      if (encryption.originalImage) {
        URL.revokeObjectURL(encryption.originalImage);
      }
    };
  }, [encryption.originalImage]);

  // Cleanup encrypted image URLs from cache when cache is completely replaced (different key/image)
  React.useEffect(() => {
    const prevCache = prevCacheRef.current;
    const currentCache = encryption.currentCache;

    logger.log("[EncryptionMode] Cache cleanup effect triggered", {
      hasPrevCache: !!prevCache,
      hasCurrentCache: !!currentCache,
      prevCacheKey: prevCache?.cacheKey,
      currentCacheKey: currentCache?.cacheKey,
    });

    // Only revoke URLs if the cache key changed (different image/key) or cache was cleared
    // Don't revoke when cache is just updated with new results (same cache key)
    const cacheKeyChanged = prevCache && currentCache && prevCache.cacheKey !== currentCache.cacheKey;
    const cacheCleared = prevCache && !currentCache;

    if (cacheKeyChanged || cacheCleared) {
      logger.log("[EncryptionMode] Revoking URLs from previous cache", {
        reason: cacheKeyChanged ? "cache key changed" : "cache cleared",
      });
      const allResults = Object.values(prevCache.results)
        .filter((methodResults): methodResults is NonNullable<typeof methodResults> => Boolean(methodResults))
        .flatMap(methodResults => Object.values(methodResults));
      allResults.forEach(result => {
        logger.log("[EncryptionMode] Revoking URL", result.encryptedImage);
        URL.revokeObjectURL(result.encryptedImage);
      });
    } else {
      logger.log("[EncryptionMode] Not revoking URLs - cache updated with same key");
    }

    prevCacheRef.current = currentCache;
  }, [encryption.currentCache]);

  // Cleanup all URLs only on component unmount (not on re-renders)
  React.useEffect(() => {
    return () => {
      logger.log("[EncryptionMode] Component unmounting - revoking all cached URLs");
      const cache = prevCacheRef.current;
      if (cache) {
        const allResults = Object.values(cache.results)
          .filter((methodResults): methodResults is NonNullable<typeof methodResults> => Boolean(methodResults))
          .flatMap(methodResults => Object.values(methodResults));
        allResults.forEach(result => {
          logger.log("[EncryptionMode] Revoking URL on unmount", result.encryptedImage);
          URL.revokeObjectURL(result.encryptedImage);
        });
      }
    };
  }, []); // Empty deps - only runs on mount/unmount

  // Auto-execute encryption when image and key are ready
  React.useEffect(() => {
    const { originalBits, key, method, isProcessing, currentCache, encryptionMethod } = encryption;

    if (!shouldAttemptEncryption(originalBits, key, isProcessing, currentCache, method, encryptionMethod)) {
      return;
    }

    // If cache is null but we have originalBits and key (e.g., after key size change),
    // we need to initialize the cache first before proceeding with encryption
    if (!currentCache) {
      logger.log("[EncryptionMode] Cache is null, initializing before encryption");
      const needsIV = method === "CBC" || method === "CTR";
      const newIV = needsIV ? generateIV() : "";
      
      // Initialize cache asynchronously and let the next effect run handle encryption
      void generateCacheKey(key, originalBits).then(cacheKey => {
        setEncryptionCache({
          cacheKey,
          iv: newIV,
          results: {},
        });
        logger.log("[EncryptionMode] Cache initialized from auto-execute effect", { cacheKey, iv: newIV });
      }).catch((error: unknown) => {
        logger.error("[EncryptionMode] Failed to generate cache key", error);
        setEncryptionError("Failed to initialize encryption cache");
      });
      return;
    }

    const iv = currentCache.iv || "";
    if (!validateIVRequirement(method, iv)) {
      return;
    }

    const attemptKey = `${String(originalBits.length)}|${key}|${method}|${iv}|${encryptionMethod}`;
    if (isDuplicateAttempt(attemptKey)) {
      return;
    }

    encryptionAttemptedRef.current = attemptKey;

    executeEncryption(originalBits, key, method, iv, encryptionMethod).catch((error: unknown) => {
      logger.error("[EncryptionMode] Encryption failed", error);
      setEncryptionError(error instanceof Error ? error.message : "Encryption failed");
      setEncryptionProcessing(false);
    });
  }, [
    encryption,
    setEncryptionProcessing,
    setEncryptionError,
    setEncryptionCache,
    shouldAttemptEncryption,
    validateIVRequirement,
    isDuplicateAttempt,
    executeEncryption,
  ]);

  /**
   * Handle image upload
   *
   * LOSSLESS ENCRYPTION WORKFLOW:
   * 1. Extract metadata (dimensions, MIME type) for later reconstruction
   * 2. Read entire file as raw bits (no format conversion)
   * 3. Store bits and metadata separately
   * 4. Create visualization using original MIME type
   * 5. Auto-generate encryption key if not present
   *
   * This ensures the original file format is preserved and can be
   * perfectly reconstructed after decryption.
   */
  const handleImageUpload = React.useCallback(
    async (file: File) => {
      try {
        encryptionAttemptedRef.current = null; // Reset attempt tracking
        setEncryptionError(null);
        setOriginalFileName(file.name);

        // Extract metadata (width, height, MIME type, filename) - stored separately
        const metadata = await extractImageMetadata(file);
        setEncryptionMetadata(metadata);
        logger.log("[EncryptionMode] Extracted metadata", metadata);

        // Read file as raw bits (lossless - includes headers, metadata, pixels)
        const rawBits = await readImageBits(file);
        logger.log("[EncryptionMode] Read raw bits", { size: rawBits.length });

        // Auto-generate key only if no key exists (backward compatible)
        let currentKey = encryption.key;
        if (!currentKey) {
          currentKey = generateKey(encryption.keySize);
          setEncryptionKey(currentKey);
        }

        // Set original bits first (this clears any existing cache)
        setOriginalBits(rawBits);

        // Generate cache key from key + image bits
        const cacheKey = await generateCacheKey(currentKey, rawBits);
        logger.log("[EncryptionMode] Generated cache key", cacheKey);

        // Preserve existing IV if it was already set, otherwise generate new one
        const existingIV = currentIV;
        const needsIV = encryption.method === "CBC" || encryption.method === "CTR";
        const newIV = existingIV || (needsIV ? generateIV() : "");

        // Initialize cache with empty results (after setting bits)
        setEncryptionCache({
          cacheKey,
          iv: newIV,
          results: {},
        });
        logger.log("[EncryptionMode] Initialized cache", { cacheKey, iv: newIV, preservedExisting: !!existingIV });

        // Create Blob URL using original MIME type for visualization
        const url = createImageBlobUrl(rawBits, metadata.mimeType);
        setOriginalImage(url);
        logger.log("[EncryptionMode] Created blob URL", url);
      } catch (error) {
        setEncryptionError(error instanceof Error ? error.message : "Failed to process image");
      }
    },
    [
      encryption.method,
      encryption.key,
      encryption.keySize,
      currentIV,
      setOriginalImage,
      setOriginalBits,
      setEncryptionMetadata,
      setEncryptionKey,
      setEncryptionCache,
      setEncryptionError,
    ]
  );

  // Handle image removal
  const handleRemoveImage = React.useCallback(() => {
    if (encryption.originalImage) {
      URL.revokeObjectURL(encryption.originalImage);
    }
    // Revoke all cached encrypted image URLs
    if (encryption.currentCache) {
      const allResults = Object.values(encryption.currentCache.results)
        .filter((methodResults): methodResults is NonNullable<typeof methodResults> => Boolean(methodResults))
        .flatMap(methodResults => Object.values(methodResults));
      allResults.forEach(result => {
        URL.revokeObjectURL(result.encryptedImage);
      });
    }
    setOriginalImage(null);
    setOriginalBits(null);
    setEncryptionMetadata(null);
    setEncryptionKey("");
    setEncryptionCache(null);
    setOriginalFileName("");
  }, [
    encryption.originalImage,
    encryption.currentCache,
    setOriginalImage,
    setOriginalBits,
    setEncryptionMetadata,
    setEncryptionKey,
    setEncryptionCache,
  ]);

  // Handle download encrypted image
  const handleDownloadImage = React.useCallback(() => {
    if (!currentEncryptedResult) return;

    // Download the actual encrypted bits, not the visualization
    // For preserve-pattern encryption, this is the complete BMP file with encrypted pixel data
    // For whole-file encryption, this is the complete encrypted file
    const blob = new Blob([currentEncryptedResult.encryptedBits.buffer as ArrayBuffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    
    const filename = generateFilename(`encrypted-${originalFileName.replace(/\.[^/.]+$/, "")}`, "enc");
    downloadImage(url, filename);
    
    // Clean up the temporary URL
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  }, [currentEncryptedResult, originalFileName]);

  /**
   * Handle download key file
   *
   * BINARY KEY FILE FORMAT:
   * Downloads a compact binary key file with frame structure:
   * - Byte 0: Key length (16, 24, or 32 for AES-128/192/256)
   * - Byte 1: IV length (0 for ECB, 16 for CBC/CTR)
   * - Bytes 2+: Key bits
   * - Bytes N+: IV bits (if present)
   *
   * The file has no extension and can be uploaded during decryption
   * to automatically populate key, IV, and detect key size.
   */
  const handleDownloadKey = React.useCallback(() => {
    if (!encryption.key) return;

    try {
      // Convert hex key and IV to byte arrays
      const keyBytes = hexToBytes(encryption.key);
      const ivBytes = encryption.method !== "ECB" && currentIV ? hexToBytes(currentIV) : undefined;

      // Generate binary key file with frame structure
      const keyFileBits = generateBinaryKeyFile(keyBytes, encryption.method, ivBytes);

      // Download with no extension
      downloadBinaryFile(keyFileBits, new Filename("encryption-key"));
    } catch (error) {
      setEncryptionError(error instanceof Error ? error.message : "Failed to generate key file");
    }
  }, [encryption.key, encryption.method, currentIV, setEncryptionError]);

  // Handle download bundle
  const handleDownloadBundle = React.useCallback(async () => {
    if (!currentEncryptedResult || !encryption.key) return;

    try {
      // Create blob URL from encrypted bits (not visualization)
      const blob = new Blob([currentEncryptedResult.encryptedBits.buffer as ArrayBuffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      
      await downloadBundle({
        encryptedImageUrl: url,
        key: encryption.key,
        iv: encryption.method !== "ECB" && currentIV ? currentIV : undefined,
        method: encryption.method,
        originalFilename: originalFileName,
      });
      
      // Clean up the temporary URL
      URL.revokeObjectURL(url);
    } catch (error) {
      setEncryptionError(error instanceof Error ? error.message : "Failed to create bundle");
    }
  }, [currentEncryptedResult, encryption.key, encryption.method, currentIV, originalFileName, setEncryptionError]);

  return (
    <div ref={ref} className="container mx-auto py-4 sm:py-6 max-w-7xl">
      <ErrorAlert
        error={encryption.error}
        onDismiss={() => {
          setEncryptionError(null);
        }}
      />

      {/* Image Input - Full width at top */}
      <div className="mb-4 sm:mb-6 w-full">
        <CompactImageInput
          onImageUpload={file => {
            handleImageUpload(file).catch((err: unknown) => {
              setEncryptionError(err instanceof Error ? err.message : "Upload failed");
            });
          }}
          onError={setEncryptionError}
          onRemove={handleRemoveImage}
          disabled={encryption.isProcessing}
          uploadedFileName={originalFileName}
          previewUrl={encryption.originalImage || undefined}
          fileSize={encryption.metadata?.fileSize}
          fileType={encryption.metadata?.mimeType}
          className="w-full"
        />
      </div>

      {/* Mobile: single column, Tablet: single column with larger spacing, Desktop: 40/60 split */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 sm:gap-6 lg:gap-8">
        {/* Input Column */}
        <div className="flex flex-col gap-4 sm:gap-6">
          <MethodSelector
            method={encryption.method}
            onMethodChange={method => {
              setEncryptionError(null);
              setEncryptionMethod(method);
            }}
            disabled={encryption.isProcessing}
          />

          <KeyInputSection
            method={encryption.method}
            keyValue={encryption.key}
            ivValue={currentIV}
            keySize={encryption.keySize}
            onKeyChange={setEncryptionKey}
            onIVChange={setCurrentIV}
            onKeySizeChange={setEncryptionKeySize}
            onError={setEncryptionError}
            disabled={encryption.isProcessing}
            showGenerate={true}
            showFileUpload={true}
            className="flex-1"
          />
        </div>

        {/* Output Column */}
        <div className="flex flex-col gap-4 sm:gap-6">
          <EncryptionApproachSelector
            selectedMethod={encryption.encryptionMethod}
            onMethodChange={setFileEncryptionMethod}
            disabled={encryption.isProcessing}
          />

          <div className={cn("transition-all duration-300", showSuccess && "ring-2 ring-green-500 rounded-lg")}>
            <ImageOutputDisplay
              imageUrl={currentEncryptedResult?.encryptedImage || null}
              placeholderText="Encrypted image will appear here"
              isLoading={encryption.isProcessing}
              loadingText="Encrypting..."
              height="mobile"
              className="md:hidden"
            />
            <ImageOutputDisplay
              imageUrl={currentEncryptedResult?.encryptedImage || null}
              placeholderText="Encrypted image will appear here"
              isLoading={encryption.isProcessing}
              loadingText="Encrypting..."
              height="tablet"
              className="hidden md:block lg:hidden"
            />
            <ImageOutputDisplay
              imageUrl={currentEncryptedResult?.encryptedImage || null}
              placeholderText="Encrypted image will appear here"
              isLoading={encryption.isProcessing}
              loadingText="Encrypting..."
              height="desktop"
              className="hidden lg:block"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <DownloadButton
              variant="image"
              onClick={handleDownloadImage}
              disabled={!currentEncryptedResult || encryption.isProcessing}
              shortcut="d"
            />
            <DownloadButton
              variant="key"
              onClick={handleDownloadKey}
              disabled={!encryption.key || encryption.isProcessing}
            />
            <DownloadButton
              variant="bundle"
              onClick={() => {
                handleDownloadBundle().catch((err: unknown) => {
                  setEncryptionError(err instanceof Error ? err.message : "Download failed");
                });
              }}
              disabled={!currentEncryptedResult || !encryption.key || encryption.isProcessing}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

EncryptionMode.displayName = "EncryptionMode";
