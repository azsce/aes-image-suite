import * as React from "react";
import { Upload } from "lucide-react";
import { validateImageUpload, ACCEPTED_IMAGE_EXTENSIONS } from "@/utils/validation";
import { CompactFileInputBase } from "./CompactFileInputBase";

export interface CompactImageInputProps {
  onImageUpload: (file: File) => void;
  onError?: (error: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  uploadedFileName?: string;
  previewUrl?: string;
  fileSize?: number;
  fileType?: string;
  className?: string;
}

export const CompactImageInput = React.memo(
  React.forwardRef<HTMLDivElement, CompactImageInputProps>(
    (
      {
        onImageUpload,
        onError,
        onRemove,
        disabled = false,
        uploadedFileName,
        previewUrl,
        fileSize,
        fileType,
        className,
      },
      ref
    ) => {
      const renderPreview = React.useCallback(() => {
        if (previewUrl) {
          return <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" loading="lazy" />;
        }
        return <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />;
      }, [previewUrl]);

      return (
        <CompactFileInputBase
          ref={ref}
          onFileSelect={onImageUpload}
          onError={onError}
          onRemove={onRemove}
          disabled={disabled}
          fileName={uploadedFileName}
          fileSize={fileSize}
          fileType={fileType}
          acceptedFileTypes={ACCEPTED_IMAGE_EXTENSIONS}
          validateFile={validateImageUpload}
          renderPreview={renderPreview}
          className={className}
          clickToUploadLabel="Select Image"
          dropLabel="Drop image here or select"
        />
      );
    }
  )
);

CompactImageInput.displayName = "CompactImageInput";
