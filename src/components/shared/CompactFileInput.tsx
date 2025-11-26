import * as React from "react";
import { FileText } from "lucide-react";
import { CompactFileInputBase } from "./CompactFileInputBase";

export interface CompactFileInputProps {
  onFileUpload: (file: File) => void;
  onError?: (error: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  uploadedFileName?: string;
  fileSize?: number;
  fileType?: string;
  acceptedFileTypes?: string[];
  className?: string;
  icon?: React.ReactNode;
}

export const CompactFileInput = React.memo(
  React.forwardRef<HTMLDivElement, CompactFileInputProps>(
    (
      {
        onFileUpload,
        onError,
        onRemove,
        disabled = false,
        uploadedFileName,
        fileSize,
        fileType,
        acceptedFileTypes,
        className,
        icon,
      },
      ref
    ) => {
      const renderPreview = React.useCallback(
        () => icon || <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />,
        [icon]
      );

      return (
        <CompactFileInputBase
          ref={ref}
          onFileSelect={onFileUpload}
          onError={onError}
          onRemove={onRemove}
          disabled={disabled}
          fileName={uploadedFileName}
          fileSize={fileSize}
          fileType={fileType}
          acceptedFileTypes={acceptedFileTypes}
          renderPreview={renderPreview}
          className={className}
          clickToUploadLabel="Select File"
          dropLabel="Drop file here or select"
        />
      );
    }
  )
);

CompactFileInput.displayName = "CompactFileInput";
