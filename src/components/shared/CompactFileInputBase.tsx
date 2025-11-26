import * as React from "react";
import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatFileSize, getFileExtension } from "@/utils/fileUtils";

export interface CompactFileInputBaseProps {
  onFileSelect: (file: File) => void;
  onError?: (error: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  acceptedFileTypes?: string[];
  validateFile?: (file: File) => Promise<{ valid: boolean; error?: string }>;
  renderPreview?: (props: { isDragging: boolean; disabled: boolean }) => React.ReactNode;
  className?: string;
  isLoading?: boolean;
  clickToUploadLabel?: string;
  dropLabel?: string;
}

function useDragAndDrop(canAcceptDrag: boolean, onFileDrop: (file: File) => void) {
  const [isDragging, setIsDragging] = React.useState(false);

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
      onFileDrop(files[0]);
    }
  };

  return {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}

export const CompactFileInputBase = React.memo(
  React.forwardRef<HTMLDivElement, CompactFileInputBaseProps>(
    (
      {
        onFileSelect,
        onError,
        onRemove,
        disabled = false,
        fileName,
        fileSize,
        fileType,
        acceptedFileTypes = [],
        validateFile,
        renderPreview,
        className,
        isLoading = false,
        clickToUploadLabel = "Select File",
        dropLabel = "Drop file here or select",
      },
      ref
    ) => {
      const [isProcessing, setIsProcessing] = React.useState(false);
      const fileInputRef = React.useRef<HTMLInputElement>(null);

      const canAcceptDrag = !disabled && !fileName;
      const isBusy = isLoading || isProcessing;

      const handleFile = async (file: File) => {
        setIsProcessing(true);

        try {
          if (validateFile) {
            const validationResult = await validateFile(file);

            if (!validationResult.valid) {
              if (onError && validationResult.error) {
                onError(validationResult.error);
              }
              return;
            }
          }

          onFileSelect(file);
        } catch (error) {
          if (onError) {
            const errorMessage = error instanceof Error ? error.message : "Failed to validate file";
            onError(errorMessage);
          }
        } finally {
          setIsProcessing(false);
        }
      };

      const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop } = useDragAndDrop(
        canAcceptDrag,
        file => {
          void handleFile(file);
        }
      );

      const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          void handleFile(files[0]);
        }
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      };

      const handleClick = () => {
        if (canAcceptDrag && fileInputRef.current) {
          fileInputRef.current.click();
        }
      };

      const handleRemoveClick = (e: React.MouseEvent) => {
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

      return (
        <Card
          ref={ref}
          className={cn(
            "transition-all duration-200 w-full",
            className,
            isDragging && "border-2 border-solid border-primary bg-primary/10",
            !isDragging && "border-2 border-dashed border-border",
            disabled && "cursor-not-allowed opacity-50",
            !disabled && !isDragging && "hover:border-primary/50 hover:bg-accent/30 cursor-pointer"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClick}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="File upload zone"
          aria-disabled={disabled}
          onKeyDown={handleKeyDown}
        >
          <CardContent className="p-0">
            <DesktopLayout
              fileName={fileName}
              fileSize={fileSize}
              fileType={fileType}
              isBusy={isBusy}
              disabled={disabled}
              onRemove={onRemove}
              handleRemove={handleRemoveClick}
              handleClick={handleClick}
              renderPreview={() => (renderPreview ? renderPreview({ isDragging, disabled }) : null)}
              clickToUploadLabel={clickToUploadLabel}
              dropLabel={dropLabel}
            />

            <MobileLayout
              fileName={fileName}
              fileSize={fileSize}
              fileType={fileType}
              isBusy={isBusy}
              disabled={disabled}
              onRemove={onRemove}
              handleRemove={handleRemoveClick}
              handleClick={handleClick}
              renderPreview={() => (renderPreview ? renderPreview({ isDragging, disabled }) : null)}
              clickToUploadLabel={clickToUploadLabel}
              dropLabel={dropLabel}
            />

            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedFileTypes.join(",")}
              onChange={handleFileInput}
              className="hidden"
              disabled={disabled}
              aria-label="Upload file"
              tabIndex={-1}
            />
          </CardContent>
        </Card>
      );
    }
  )
);

interface LayoutProps {
  readonly fileName?: string;
  readonly fileSize?: number;
  readonly fileType?: string;
  readonly isBusy: boolean;
  readonly disabled: boolean;
  readonly onRemove?: () => void;
  readonly handleRemove: (e: React.MouseEvent) => void;
  readonly handleClick: () => void;
  readonly renderPreview: () => React.ReactNode;
  readonly clickToUploadLabel: string;
  readonly dropLabel: string;
}

function FileInfo({
  fileName,
  fileSize,
  fileType,
}: {
  readonly fileName: string;
  readonly fileSize?: number;
  readonly fileType?: string;
}) {
  return (
    <>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-sm font-medium truncate">{fileName}</p>
      </div>
      <div className="flex-shrink-0 flex items-center gap-2 text-xs text-muted-foreground">
        {fileSize && <span>{formatFileSize(fileSize)}</span>}
        {fileType && <span>{getFileExtension(fileType)}</span>}
      </div>
    </>
  );
}

function EmptyState({ isBusy, dropLabel }: { readonly isBusy: boolean; readonly dropLabel: string }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-sm text-muted-foreground">{isBusy ? "Processing..." : dropLabel}</p>
    </div>
  );
}

function ActionButton({
  hasFile,
  onRemove,
  handleRemove,
  handleClick,
  disabled,
  isBusy,
  clickToUploadLabel,
}: {
  readonly hasFile: boolean;
  readonly onRemove?: () => void;
  readonly handleRemove: (e: React.MouseEvent) => void;
  readonly handleClick: () => void;
  readonly disabled: boolean;
  readonly isBusy: boolean;
  readonly clickToUploadLabel: string;
}) {
  if (hasFile && onRemove) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRemove}
        disabled={disabled}
        className="flex-shrink-0 h-8 w-8 p-0"
        aria-label="Remove file"
        type="button"
      >
        <X className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={e => {
        e.stopPropagation();
        handleClick();
      }}
      disabled={disabled || isBusy}
      className="flex-shrink-0"
      type="button"
    >
      {clickToUploadLabel}
    </Button>
  );
}

function DesktopLayout({
  fileName,
  fileSize,
  fileType,
  isBusy,
  disabled,
  onRemove,
  handleRemove,
  handleClick,
  renderPreview,
  clickToUploadLabel,
  dropLabel,
}: LayoutProps) {
  const hasFile = Boolean(fileName);

  return (
    <div className="hidden sm:flex items-center h-12 gap-3 px-3 w-full">
      <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
        {renderPreview()}
      </div>

      {hasFile && fileName ? (
        <FileInfo fileName={fileName} fileSize={fileSize} fileType={fileType} />
      ) : (
        <EmptyState isBusy={isBusy} dropLabel={dropLabel} />
      )}

      <ActionButton
        hasFile={hasFile}
        onRemove={onRemove}
        handleRemove={handleRemove}
        handleClick={handleClick}
        disabled={disabled}
        isBusy={isBusy}
        clickToUploadLabel={clickToUploadLabel}
      />
    </div>
  );
}

function MobileLayout({
  fileName,
  fileSize,
  fileType,
  isBusy,
  disabled,
  onRemove,
  handleRemove,
  handleClick,
  renderPreview,
  clickToUploadLabel,
  dropLabel,
}: LayoutProps) {
  const hasFile = Boolean(fileName);

  return (
    <div className="sm:hidden w-full">
      <div className="flex items-center h-12 gap-3 px-3 w-full">
        <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
          {renderPreview()}
        </div>

        {hasFile && fileName ? (
          <>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-sm font-medium truncate">{fileName}</p>
            </div>
            {onRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={disabled}
                className="flex-shrink-0 h-8 w-8 p-0"
                aria-label="Remove file"
                type="button"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">{isBusy ? "Processing..." : dropLabel}</p>
          </div>
        )}
      </div>

      {hasFile ? (
        <div className="flex items-center justify-between h-10 px-3 border-t w-full">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {fileSize && <span>{formatFileSize(fileSize)}</span>}
            {fileType && <span>{getFileExtension(fileType)}</span>}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-10 px-3 border-t w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClick}
            disabled={disabled || isBusy}
            className="w-full"
            type="button"
          >
            {clickToUploadLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

CompactFileInputBase.displayName = "CompactFileInputBase";
