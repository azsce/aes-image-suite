import * as React from "react";
import { Upload, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { validateImageUpload, ACCEPTED_IMAGE_EXTENSIONS } from "@/utils/validation";
import { appConfig } from "../../../app.config";

export interface ImageUploadZoneProps {
  onImageUpload: (file: File) => void;
  onError?: (error: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  label?: string;
  uploadedFileName?: string;
  previewUrl?: string;
}

export const ImageUploadZone = React.memo(
  React.forwardRef<HTMLDivElement, ImageUploadZoneProps>(
    (
      {
        onImageUpload,
        onError,
        onRemove,
        disabled = false,
        label = "Drop image here or click to browse",
        uploadedFileName,
        previewUrl,
      },
      ref
    ) => {
      const [isDragging, setIsDragging] = React.useState(false);
      const [isUploading, setIsUploading] = React.useState(false);
      const fileInputRef = React.useRef<HTMLInputElement>(null);

      const prefersReducedMotion = React.useMemo(() => {
        if (typeof window === "undefined") return false;
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      }, []);

      const canAcceptDrag = !disabled && !previewUrl;

      const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (canAcceptDrag) {
          setIsDragging(true);
        }
      };

      const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
      };

      const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };

      const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (!canAcceptDrag) return;

        const files = e.dataTransfer.files;
        if (files.length > 0) {
          void handleFile(files[0]);
        }
      };

      const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          void handleFile(files[0]);
        }
        // Reset input value to allow re-uploading the same file
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      };

      const handleFile = async (file: File) => {
        setIsUploading(true);

        try {
          // Comprehensive validation: type, size, and integrity
          const validationResult = await validateImageUpload(file);

          if (!validationResult.valid) {
            if (onError && validationResult.error) {
              onError(validationResult.error);
            }
            return;
          }

          // File is valid, proceed with upload
          onImageUpload(file);
        } catch (error) {
          if (onError) {
            const errorMessage = error instanceof Error ? error.message : "Failed to validate image file";
            onError(errorMessage);
          }
        } finally {
          setIsUploading(false);
        }
      };

      const handleClick = () => {
        if (canAcceptDrag && fileInputRef.current) {
          fileInputRef.current.click();
        }
      };

      const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onRemove) {
          onRemove();
        }
      };

      const isActivationKey = (key: string) => key === "Enter" || key === " ";

      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isActivationKey(e.key) && canAcceptDrag) {
          e.preventDefault();
          handleClick();
        }
      };

      // Show preview if image is uploaded
      if (previewUrl) {
        return (
          <Card ref={ref} className="relative">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="relative w-[150px] h-[150px] flex-shrink-0 rounded-md overflow-hidden bg-muted">
                  <img src={previewUrl} alt="Uploaded preview" className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{uploadedFileName || "Uploaded image"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Image loaded successfully</p>
                </div>
                {onRemove && !disabled && (
                  <button
                    onClick={handleRemove}
                    className="flex-shrink-0 p-3 sm:p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Remove image"
                    type="button"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      }

      return (
        <Card
          ref={ref}
          className={cn(
            "cursor-pointer transition-all duration-200",
            isDragging ? "border-2 border-solid border-primary bg-primary/10" : "border-2 border-dashed border-border",
            !prefersReducedMotion && isDragging && "scale-[1.01]",
            disabled && "cursor-not-allowed opacity-50",
            !disabled && !isDragging && "hover:border-primary/50 hover:bg-accent/30"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClick}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={label}
          aria-disabled={disabled}
          onKeyDown={handleKeyDown}
        >
          <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 min-h-[250px] sm:min-h-[250px] text-center">
            {isUploading ? (
              <>
                <div
                  className="h-10 w-10 mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium">Uploading...</p>
              </>
            ) : (
              <>
                <Upload
                  className={cn(
                    "h-10 w-10 mb-4 transition-colors",
                    isDragging ? "text-primary" : "text-muted-foreground"
                  )}
                  aria-hidden="true"
                />
                <p className="text-sm font-medium mb-1">{label}</p>
                <p className="text-xs text-muted-foreground">
                  Supports all image formats (max {appConfig.upload.maxFileSizeMB}MB)
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_EXTENSIONS.join(",")}
              onChange={handleFileInput}
              className="hidden"
              disabled={disabled}
              aria-label="Upload image file"
              tabIndex={-1}
            />
          </CardContent>
        </Card>
      );
    }
  )
);

ImageUploadZone.displayName = "ImageUploadZone";
