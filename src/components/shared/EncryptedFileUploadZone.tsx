import * as React from "react";
import { Upload, X, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EncryptedFileUploadZoneProps {
  onFileUpload: (file: File) => void;
  onError?: (error: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  label?: string;
  uploadedFileName?: string;
  hasFile?: boolean;
}

export const EncryptedFileUploadZone = React.memo(
  React.forwardRef<HTMLDivElement, EncryptedFileUploadZoneProps>(
    (
      {
        onFileUpload,
        onError,
        onRemove,
        disabled = false,
        label = "Drop encrypted file here or click to browse",
        uploadedFileName = "",
        hasFile = false,
      },
      ref
    ) => {
      const [isDragging, setIsDragging] = React.useState(false);
      const fileInputRef = React.useRef<HTMLInputElement>(null);
      const dragCounterRef = React.useRef(0);

      const validateFile = (file: File): boolean => {
        // Accept .enc files or files without extension
        const hasEncExtension = file.name.toLowerCase().endsWith(".enc");
        const hasNoExtension = !file.name.includes(".");

        if (!hasEncExtension && !hasNoExtension) {
          if (onError) {
            onError("Please upload an encrypted file (.enc)");
          }
          return false;
        }

        return true;
      };

      const handleFile = (file: File) => {
        if (validateFile(file)) {
          onFileUpload(file);
        }
      };

      const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current += 1;
        if (e.dataTransfer.items.length > 0) {
          setIsDragging(true);
        }
      };

      const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current === 0) {
          setIsDragging(false);
        }
      };

      const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
      };

      const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounterRef.current = 0;

        if (disabled) return;

        const files = e.dataTransfer.files;
        if (files.length > 0) {
          handleFile(files[0]);
        }
      };

      const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files?.length) {
          handleFile(files[0]);
        }
      };

      const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onRemove) {
          onRemove();
        }
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      };

      const handleClick = () => {
        if (!disabled && !hasFile) {
          fileInputRef.current?.click();
        }
      };

      return (
        <Card ref={ref}>
          <CardHeader>
            <CardTitle className="text-lg">Encrypted File</CardTitle>
            <CardDescription>Upload the encrypted file (.enc)</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={handleClick}
              className={cn(
                "relative flex flex-col items-center justify-center",
                "min-h-[200px] sm:min-h-[180px] p-6",
                "border-2 border-dashed rounded-lg transition-all duration-200",
                "cursor-pointer hover:border-primary/50 hover:bg-accent/5",
                isDragging && "border-primary bg-accent/10 scale-[1.02]",
                disabled && "opacity-50 cursor-not-allowed hover:border-border hover:bg-transparent",
                hasFile && "cursor-default hover:border-border hover:bg-transparent"
              )}
              role="button"
              tabIndex={disabled || hasFile ? -1 : 0}
              aria-label={label}
              onKeyDown={e => {
                if ((e.key === "Enter" || e.key === " ") && !disabled && !hasFile) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".enc,*"
                onChange={handleFileInputChange}
                className="hidden"
                disabled={disabled}
                aria-label="Upload encrypted file"
              />

              {hasFile && uploadedFileName ? (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="relative flex items-center justify-center w-24 h-24 rounded-lg bg-muted">
                    <Lock className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col items-center gap-2 w-full">
                    <p className="text-sm font-medium text-center break-all px-4">{uploadedFileName}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemove}
                      disabled={disabled}
                      className="h-9 text-xs"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div
                      className={cn("p-4 rounded-full transition-colors", isDragging ? "bg-primary/10" : "bg-muted")}
                    >
                      <Upload
                        className={cn(
                          "h-8 w-8 transition-colors",
                          isDragging ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">Accepts .enc files</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }
  )
);

EncryptedFileUploadZone.displayName = "EncryptedFileUploadZone";
