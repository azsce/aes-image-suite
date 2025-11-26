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
import { cn } from "@/lib/utils";
import type { WorkerMessage } from "@/types/crypto.types";
import type { ComparisonResult as ComparisonResultType } from "@/types/store.types";
import { logger } from "@/utils/logger";

/**
 * Handle successful decryption result
 *
 * LOSSLESS DECRYPTION: After decryption, the recovered bits are used to
 * create a Blob URL with the original MIME type (from stored metadata).
 * This ensures the browser correctly interprets the file format, and the
 * result is bit-identical to the original file before encryption.
 * 
 * PRESERVE PATTERN SUPPORT: If a BMP header was stored during loading,
 * recombines it with the decrypted body to reconstruct the complete BMP file.
 */
function handleDecryptionSuccess(
  bits: Uint8Array,
  mimeType: string,
  setDecryptedImage: (url: string | null) => void,
  setDecryptionProcessing: (processing: boolean) => void,
  announce: (message: string, priority: "polite" | "assertive") => void,
  setShowSuccess: (show: boolean) => void
) {
  logger.log("[DecryptionMode] Creating blob from decrypted bits");
  
  // Check if we have a BMP header stored (preserve-pattern decryption)
  const bmpHeader = (window as unknown as { bmpHeaderForDecryption?: Uint8Array }).bmpHeaderForDecryption;
  let finalBits = bits;
  
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
    mimeType = "image/bmp";
  }
  
  const url = createImageBlobUrl(finalBits, mimeType);
  logger.log("[DecryptionMode] Setting decrypted image URL", url);
  setDecryptedImage(url);
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
  setDecryptedImage: (url: string | null) => void;
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
    setDecryptedImage,
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
      setDecryptedImage,
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
 */
function handleErrorMessage(
  message: WorkerMessage,
  setDecryptionError: (error: string | null) => void,
  setDecryptionProcessing: (processing: boolean) => void
) {
  logger.error("[DecryptionMode] Received ERROR from worker", message.payload?.error);
  setDecryptionError(
    message.payload?.error || "Decryption failed. Please verify the key and encryption method are correct"
  );
  setDecryptionProcessing(false);
}

/**
 * Handle worker message
 */
function handleWorkerMessage(params: WorkerMessageHandlerParams) {
  const { message, setDecryptionError, setDecryptionProcessing } = params;

  logger.log("[DecryptionMode] Received message from worker", message.type);

  if (message.type === "RESULT" && message.payload?.bits) {
    handleResultMessage(params);
  } else if (message.type === "ERROR") {
    handleErrorMessage(message, setDecryptionError, setDecryptionProcessing);
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
 * Load and process encrypted image data
 *
 * LOSSLESS DECRYPTION: Loads the complete encrypted file as raw bits,
 * validates the data size for block cipher modes, and prepares it for
 * decryption. 
 * 
 * PRESERVE PATTERN SUPPORT: If the file is a BMP (preserve-pattern encryption),
 * splits it into header and body, then decrypts only the body (pixel data).
 * The header is stored separately and will be recombined after decryption.
 */
async function loadEncryptedImageData(encryptedImage: string, method: string) {
  logger.log("[DecryptionMode] Fetching encrypted image", encryptedImage);
  const response = await fetch(encryptedImage);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const fullData = new Uint8Array(arrayBuffer);
  logger.log("[DecryptionMode] Encrypted data loaded", { 
    size: fullData.length,
    firstBytes: Array.from(fullData.slice(0, 4)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
    blobType: blob.type,
  });

  // Check if this is a BMP file (preserve-pattern encryption)
  const isBmp = isBmpFile(fullData);
  logger.log("[DecryptionMode] BMP detection result", { 
    isBmp,
    byte0: fullData[0],
    byte1: fullData[1],
    expectedByte0: 0x42,
    expectedByte1: 0x4d,
  });
  
  if (isBmp) {
    logger.log("[DecryptionMode] Detected BMP file - using preserve-pattern decryption");
    const { header, body } = splitBmpForDecryption(fullData);
    
    // Store header for later recombination
    (window as unknown as { bmpHeaderForDecryption?: Uint8Array }).bmpHeaderForDecryption = header;
    
    // Validate and return only the body for decryption
    validateEncryptedDataSize(method, body);
    return body;
  }

  // Whole-file encryption - decrypt entire file
  logger.log("[DecryptionMode] Using whole-file decryption");
  validateEncryptedDataSize(method, fullData);
  return fullData;
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
    setDecryptedImage,
    setDecryptionProcessing,
    setDecryptionError,
  } = useAppStore();

  const { announce } = useScreenReaderAnnouncement();
  const workerRef = React.useRef<Worker | null>(null);
  const [encryptedFileName, setEncryptedFileName] = React.useState<string>("");
  const [uploadedFileStats, setUploadedFileStats] = React.useState<{ size: number; type: string } | null>(null);
  const decryptionAttemptedRef = React.useRef<string | null>(null);

  const [showSuccess, setShowSuccess] = React.useState(false);

  // Comparison state
  const [comparisonImage, setComparisonImage] = React.useState<string | null>(null);
  const [comparisonFileName, setComparisonFileName] = React.useState<string>("");
  const [comparisonResult, setComparisonResult] = React.useState<ComparisonResultType | null>(null);
  const [isComparing, setIsComparing] = React.useState(false);
  const [comparisonError, setComparisonError] = React.useState<string | null>(null);
  const [showCompareSection, setShowCompareSection] = React.useState(false);

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
        setDecryptedImage,
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
  }, [decryption.metadata, setDecryptedImage, setDecryptionError, setDecryptionProcessing, announce]);

  // Track previous URLs for cleanup
  const prevEncryptedImageRef = React.useRef<string | null>(null);
  const prevDecryptedImageRef = React.useRef<string | null>(null);

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

  React.useEffect(() => {
    // Revoke previous decrypted image URL if it changed
    if (prevDecryptedImageRef.current && prevDecryptedImageRef.current !== decryption.decryptedImage) {
      URL.revokeObjectURL(prevDecryptedImageRef.current);
    }
    prevDecryptedImageRef.current = decryption.decryptedImage;

    // Cleanup on unmount
    return () => {
      if (decryption.decryptedImage) {
        URL.revokeObjectURL(decryption.decryptedImage);
      }
    };
  }, [decryption.decryptedImage]);

  // Auto-execute decryption when all inputs are ready
  React.useEffect(() => {
    const { encryptedImage, key, method, isProcessing, iv, decryptedImage } = decryption;

    // Don't re-decrypt if we already have a decrypted image
    if (decryptedImage) {
      logger.log("[DecryptionMode] Already have decrypted image, skipping");
      return;
    }

    if (!encryptedImage || !key || isProcessing) {
      return;
    }

    // Check if we've already attempted decryption with these exact inputs
    const attemptKey = `${encryptedImage}|${key}|${method}|${iv || ""}`;
    if (decryptionAttemptedRef.current === attemptKey) {
      logger.log("[DecryptionMode] Already attempted decryption with these inputs, skipping");
      return;
    }

    // Check if IV is needed and available
    const needsIV = method === "CBC" || method === "CTR";
    if (needsIV && !iv) {
      return;
    }

    // Mark this attempt
    decryptionAttemptedRef.current = attemptKey;

    // Trigger decryption
    const performDecryption = async () => {
      logger.log("[DecryptionMode] Starting decryption process");
      setDecryptionProcessing(true);
      setDecryptionError(null);

      try {
        const encryptedBits = await loadEncryptedImageData(encryptedImage, method);
        sendDecryptionToWorker({ worker: workerRef.current, encryptedBits, key, method, iv });
      } catch (error) {
        logger.error("[DecryptionMode] Error during decryption setup", error);
        setDecryptionError(
          error instanceof Error
            ? error.message
            : "Decryption failed. Please verify the key and encryption method are correct"
        );
        setDecryptionProcessing(false);
      }
    };

    void performDecryption();
  }, [decryption, setDecryptionProcessing, setDecryptionError]);

  /**
   * Handle encrypted file upload
   *
   * LOSSLESS DECRYPTION WORKFLOW:
   * 1. Read encrypted file as raw bits (no format assumptions)
   * 2. Store bits for decryption
   * 3. Decryption will use stored metadata to reconstruct original format
   * 4. Result will be bit-identical to original file
   *
   * The encrypted file contains the complete encrypted data including
   * all headers and metadata from the original file.
   */
  const handleEncryptedFileUpload = React.useCallback(
    async (file: File) => {
      try {
        decryptionAttemptedRef.current = null; // Reset attempt tracking
        setDecryptionError(null);
        setDecryptedImage(null);
        setEncryptedFileName(file.name);
        setUploadedFileStats({ size: file.size, type: file.type });

        // Read encrypted file as raw bits (complete encrypted data)
        const arrayBuffer = await file.arrayBuffer();
        const encryptedBits = new Uint8Array(arrayBuffer);

        // Create Blob URL for storage
        const blob = new Blob([encryptedBits.buffer], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);

        setEncryptedImageForDecryption(url);
      } catch (error) {
        setDecryptionError(error instanceof Error ? error.message : "Failed to process encrypted file");
      }
    },
    [setEncryptedImageForDecryption, setDecryptedImage, setDecryptionError]
  );

  // Handle image removal
  const handleRemoveImage = React.useCallback(() => {
    if (decryption.encryptedImage) {
      URL.revokeObjectURL(decryption.encryptedImage);
    }
    if (decryption.decryptedImage) {
      URL.revokeObjectURL(decryption.decryptedImage);
    }
    setEncryptedImageForDecryption(null);
    setDecryptedImage(null);
    setEncryptedFileName("");
    setUploadedFileStats(null);
  }, [decryption.encryptedImage, decryption.decryptedImage, setEncryptedImageForDecryption, setDecryptedImage]);

  // Handle download decrypted image
  const handleDownloadImage = React.useCallback(() => {
    if (!decryption.decryptedImage) return;

    // Use stored metadata for filename, or fallback to encrypted filename
    const originalFilename = decryption.metadata?.filename || encryptedFileName;
    const baseFilename = originalFilename.replace(/\.[^/.]+$/, "");

    // Get file extension from metadata MIME type, or fallback to png
    const mimeType = decryption.metadata?.mimeType || "image/png";
    const extension = mimeType.split("/")[1] || "png";

    const filename = generateFilename(`decrypted-${baseFilename}`, extension);
    downloadImage(decryption.decryptedImage, filename);
  }, [decryption.decryptedImage, decryption.metadata, encryptedFileName]);

  // Handle comparison image upload
  const handleComparisonImageUpload = React.useCallback(async (file: File) => {
    try {
      setComparisonError(null);
      setComparisonResult(null);
      setComparisonFileName(file.name);

      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: file.type });
      const url = URL.createObjectURL(blob);

      setComparisonImage(url);
    } catch (error) {
      setComparisonError(error instanceof Error ? error.message : "Failed to process comparison image");
    }
  }, []);

  // Handle comparison image removal
  const handleRemoveComparisonImage = React.useCallback(() => {
    if (comparisonImage) {
      URL.revokeObjectURL(comparisonImage);
    }
    setComparisonImage(null);
    setComparisonFileName("");
    setComparisonResult(null);
    setComparisonError(null);
  }, [comparisonImage]);

  // Handle compare action
  const handleCompare = React.useCallback(async () => {
    if (!decryption.decryptedImage || !comparisonImage) {
      setComparisonError("Please upload an image to compare");
      return;
    }

    setIsComparing(true);
    setComparisonError(null);
    setComparisonResult(null);

    try {
      const result = await compareImageBits(decryption.decryptedImage, comparisonImage);
      setComparisonResult(result);
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
  }, [decryption.decryptedImage, comparisonImage, announce]);

  // Auto-compare when both images are ready
  React.useEffect(() => {
    if (decryption.decryptedImage && comparisonImage && !isComparing && !comparisonResult) {
      void handleCompare();
    }
  }, [decryption.decryptedImage, comparisonImage, isComparing, comparisonResult, handleCompare]);

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
              imageUrl={decryption.decryptedImage}
              placeholderText="Decrypted image will appear here"
              isLoading={decryption.isProcessing}
              loadingText="Decrypting..."
              height="mobile"
              className="md:hidden"
            />
            <ImageOutputDisplay
              imageUrl={decryption.decryptedImage}
              placeholderText="Decrypted image will appear here"
              isLoading={decryption.isProcessing}
              loadingText="Decrypting..."
              height="tablet"
              className="hidden md:block lg:hidden"
            />
            <ImageOutputDisplay
              imageUrl={decryption.decryptedImage}
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
                disabled={!decryption.decryptedImage || decryption.isProcessing}
                shortcut="d"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCompareSection(!showCompareSection);
                }}
                disabled={!decryption.decryptedImage || decryption.isProcessing}
                className="min-h-[44px] px-4 sm:px-3 py-3 sm:py-2"
              >
                <GitCompare className="h-4 w-4 mr-2" />
                <span>{showCompareSection ? "Hide Compare" : "Compare Image"}</span>
              </Button>
            </div>

            {/* Comparison Section */}
            {showCompareSection && decryption.decryptedImage && (
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
