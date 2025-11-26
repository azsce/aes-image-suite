import * as React from "react";
import { ImageUploadZone } from "@/components/shared/ImageUploadZone";
import { ComparisonResult } from "@/components/shared/ComparisonResult";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { useAppStore } from "@/store/app-store";
import { useScreenReaderAnnouncement } from "@/hooks/useScreenReaderAnnouncement";
import { compareImageBits } from "@/utils/imageComparison";
import { cn } from "@/lib/utils";
import { logger } from "@/utils/logger";

/**
 * Comparison Mode Component
 * Allows users to compare two images pixel-by-pixel to verify they are identical
 */
export const ComparisonMode = React.forwardRef<HTMLDivElement>((_, ref) => {
  const {
    comparison,
    setComparisonImageA,
    setComparisonImageB,
    setComparisonProcessing,
    setComparisonResult,
    setComparisonError,
  } = useAppStore();

  const { announce } = useScreenReaderAnnouncement();
  const { imageA, imageB, isProcessing, result, error } = comparison;
  const [showSuccess, setShowSuccess] = React.useState(false);

  // Track the last compared image pair to prevent infinite loops
  const lastComparedPairRef = React.useRef<string>("");

  // Announce processing state changes
  React.useEffect(() => {
    if (isProcessing) {
      announce("Comparing images, please wait", "polite");
    }
  }, [isProcessing, announce]);

  // Announce errors
  React.useEffect(() => {
    if (error) {
      announce(`Error: ${error}`, "assertive");
    }
  }, [error, announce]);

  // Announce comparison results
  React.useEffect(() => {
    if (result) {
      if (result.identical) {
        announce("Comparison complete. Files are identical - 100% bit-perfect match", "polite");
      } else if (result.sizeMismatch) {
        announce(`Comparison complete. Files have different sizes`, "polite");
      } else {
        announce(`Comparison complete. Files differ by ${result.differencePercentage.toFixed(4)} percent`, "polite");
      }
    }
  }, [result, announce]);

  /**
   * Handle image A upload
   */
  const handleImageAUpload = React.useCallback(
    (file: File) => {
      logger.log("[ComparisonMode] 📤 Starting Image A upload", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        logger.log("[ComparisonMode] ✅ Image A loaded successfully", {
          dataUrlLength: dataUrl.length,
          dataUrlPrefix: dataUrl.substring(0, 50),
        });
        setComparisonImageA(dataUrl);
        setComparisonError(null);
      };
      reader.onerror = () => {
        logger.error("[ComparisonMode] ❌ Failed to read Image A file");
        setComparisonError("Failed to read file. Please try again");
      };
      reader.readAsDataURL(file);
    },
    [setComparisonImageA, setComparisonError]
  );

  /**
   * Handle image B upload
   */
  const handleImageBUpload = React.useCallback(
    (file: File) => {
      logger.log("[ComparisonMode] 📤 Starting Image B upload", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        logger.log("[ComparisonMode] ✅ Image B loaded successfully", {
          dataUrlLength: dataUrl.length,
          dataUrlPrefix: dataUrl.substring(0, 50),
        });
        setComparisonImageB(dataUrl);
        setComparisonError(null);
      };
      reader.onerror = () => {
        logger.error("[ComparisonMode] ❌ Failed to read Image B file");
        setComparisonError("Failed to read file. Please try again");
      };
      reader.readAsDataURL(file);
    },
    [setComparisonImageB, setComparisonError]
  );

  /**
   * Handle image A removal
   */
  const handleRemoveImageA = React.useCallback(() => {
    logger.log("[ComparisonMode] 🗑️ Removing Image A");
    lastComparedPairRef.current = ""; // Reset comparison tracking
    setComparisonImageA(null);
    setComparisonResult(null);
    setComparisonError(null);
  }, [setComparisonImageA, setComparisonResult, setComparisonError]);

  /**
   * Handle image B removal
   */
  const handleRemoveImageB = React.useCallback(() => {
    logger.log("[ComparisonMode] 🗑️ Removing Image B");
    lastComparedPairRef.current = ""; // Reset comparison tracking
    setComparisonImageB(null);
    setComparisonResult(null);
    setComparisonError(null);
  }, [setComparisonImageB, setComparisonResult, setComparisonError]);

  /**
   * Handle upload errors
   */
  const handleUploadError = React.useCallback(
    (errorMessage: string) => {
      setComparisonError(errorMessage);
    },
    [setComparisonError]
  );

  /**
   * Auto-execute comparison when both images are uploaded
   */
  React.useEffect(() => {
    // Only depend on imageA and imageB, not on isProcessing
    // This prevents infinite loops when processing state changes

    if (!imageA || !imageB) {
      logger.log("[ComparisonMode] ⏸️ Cannot perform comparison - missing images", {
        hasImageA: !!imageA,
        hasImageB: !!imageB,
      });
      return;
    }

    // Create a unique key for this image pair
    const currentPairKey = `${imageA.substring(0, 100)}_${imageB.substring(0, 100)}`;

    // Check if we've already compared this exact pair
    if (lastComparedPairRef.current === currentPairKey) {
      logger.log("[ComparisonMode] ⏭️ Skipping comparison - already compared this pair", {
        currentPairKey: currentPairKey.substring(0, 50),
      });
      return;
    }

    // Check if already processing
    if (isProcessing) {
      logger.log("[ComparisonMode] ⏸️ Cannot perform comparison - already processing");
      return;
    }

    logger.log("[ComparisonMode] 🚀 Starting comparison process", {
      imageALength: imageA.length,
      imageBLength: imageB.length,
      pairKey: currentPairKey.substring(0, 50),
    });

    // Mark this pair as being compared
    lastComparedPairRef.current = currentPairKey;

    const performComparison = async () => {
      logger.log("[ComparisonMode] 🔧 Setting processing state to true");
      setComparisonProcessing(true);
      setComparisonError(null);

      try {
        logger.log("[ComparisonMode] 📊 Calling compareImageBits utility");
        const comparisonResult = await compareImageBits(imageA, imageB);
        logger.log("[ComparisonMode] ✅ Comparison completed successfully", {
          identical: comparisonResult.identical,
          differencePercentage: comparisonResult.differencePercentage,
          sizeMismatch: comparisonResult.sizeMismatch,
          differenceCount: comparisonResult.differenceCount,
          totalBits: comparisonResult.totalBits,
        });
        setComparisonResult(comparisonResult);

        // Show success animation if images are identical
        if (comparisonResult.identical) {
          logger.log("[ComparisonMode] 🎉 Images are identical, showing success animation");
          setShowSuccess(true);
          setTimeout(() => {
            logger.log("[ComparisonMode] 🎬 Hiding success animation");
            setShowSuccess(false);
          }, 2000);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Image comparison failed. Please try again";
        logger.error("[ComparisonMode] ❌ Comparison failed", {
          error: err,
          errorMessage,
        });
        setComparisonError(errorMessage);
        setComparisonResult(null);
      } finally {
        logger.log("[ComparisonMode] 🔧 Setting processing state to false");
        setComparisonProcessing(false);
      }
    };

    performComparison().catch((err: unknown) => {
      logger.error("[ComparisonMode] ❌ Unhandled error in performComparison", {
        error: err,
      });
      setComparisonError(err instanceof Error ? err.message : "Comparison failed");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageA, imageB]);

  return (
    <div ref={ref} className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <ErrorAlert
        error={error}
        onDismiss={() => {
          setComparisonError(null);
        }}
      />

      {/* Image Upload Zones - Mobile: stacked, Tablet/Desktop: side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        {/* Image A Upload Zone */}
        <div className="space-y-2 sm:space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Image A</h2>
          <ImageUploadZone
            onImageUpload={handleImageAUpload}
            onError={handleUploadError}
            onRemove={handleRemoveImageA}
            disabled={isProcessing}
            label="Drop first image here or click to browse"
            uploadedFileName="Image A"
            previewUrl={imageA || undefined}
          />
        </div>

        {/* Image B Upload Zone */}
        <div className="space-y-2 sm:space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Image B</h2>
          <ImageUploadZone
            onImageUpload={handleImageBUpload}
            onError={handleUploadError}
            onRemove={handleRemoveImageB}
            disabled={isProcessing}
            label="Drop second image here or click to browse"
            uploadedFileName="Image B"
            previewUrl={imageB || undefined}
          />
        </div>
      </div>

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="flex items-center justify-center p-8 bg-muted/50 rounded-lg border-2 border-dashed border-border">
          <div className="text-center">
            <div
              className="h-10 w-10 mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            <p className="text-sm font-medium">Comparing files...</p>
            <p className="text-xs text-muted-foreground mt-1">Performing bit-by-bit comparison for 100% accuracy</p>
          </div>
        </div>
      )}

      {/* Comparison Result */}
      {!isProcessing && result && (
        <div
          className={cn(
            "transition-all duration-300",
            showSuccess && result.identical && "ring-2 ring-green-500 rounded-lg"
          )}
        >
          <ComparisonResult result={result} />
        </div>
      )}

      {/* Empty State */}
      {!imageA && !imageB && !isProcessing && !result && (
        <div className="flex items-center justify-center p-12 bg-muted/30 rounded-lg border-2 border-dashed border-border">
          <div className="text-center max-w-md">
            <p className="text-sm font-medium text-muted-foreground">Upload two images to compare</p>
            <p className="text-xs text-muted-foreground mt-2">
              The comparison will automatically start once both images are uploaded
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

ComparisonMode.displayName = "ComparisonMode";
