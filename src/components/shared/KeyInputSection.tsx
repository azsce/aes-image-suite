import * as React from "react";
import { Upload, Dices, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseKeyFile, parseBinaryKeyFile, validateBinaryKeyFile } from "@/utils/keyFileHandler";
import { generateKey, generateIV, bytesToHex } from "@/utils/hexUtils";
import { getKeyValidationState, getIVValidationState, EncryptionKeyInput, IVInput } from "@/utils/validation";
import type { EncryptionMethod } from "@/types/store.types";

/**
 * AES key size in bits
 * - 128-bit: 16 bytes (32 hex characters)
 * - 192-bit: 24 bytes (48 hex characters)
 * - 256-bit: 32 bytes (64 hex characters)
 */
export type KeySize = 128 | 192 | 256;

/**
 * KeyInputSection component props
 *
 * This component handles encryption key and IV input with support for:
 * - Manual hex input with real-time validation
 * - Binary key file upload (frame structure with auto-detection)
 * - JSON key file upload (legacy format)
 * - Key generation (encryption mode only)
 * - Multiple AES key sizes (128, 192, 256-bit)
 */
export interface KeyInputSectionProps {
  method: EncryptionMethod; // Encryption mode (ECB, CBC, CTR)
  keyValue: string; // Current key value (hex string)
  ivValue: string; // Current IV value (hex string)
  onKeyChange: (key: string) => void; // Key change handler
  onIVChange: (iv: string) => void; // IV change handler
  onMethodChange?: (method: EncryptionMethod) => void; // Method change handler (for key file upload)
  onError?: (error: string) => void; // Error handler
  disabled?: boolean; // Disable all inputs
  showFileUpload?: boolean; // Show file upload button
  keySize?: KeySize; // Current key size (128, 192, or 256)
  onKeySizeChange?: (keySize: KeySize) => void; // Key size change handler
  showGenerate?: boolean; // Show generate buttons (encryption mode only)
  showKeySizeSelector?: boolean; // Show key size selector (defaults to showGenerate value if not provided)
  className?: string;
}

export const KeyInputSection = React.memo(
  React.forwardRef<HTMLDivElement, KeyInputSectionProps>(
    (
      {
        method,
        keyValue,
        ivValue,
        onKeyChange,
        onIVChange,
        onMethodChange,
        onError,
        disabled = false,
        showFileUpload = true,
        keySize = 256,
        onKeySizeChange,
        showGenerate = true,
        showKeySizeSelector,
        className,
      },
      ref
    ) => {
      const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null);
      const fileInputRef = React.useRef<HTMLInputElement>(null);

      const needsIV = method === "CBC" || method === "CTR";

      // Ensure keyValue and ivValue are always strings
      const safeKeyValue = keyValue || "";
      const safeIVValue = ivValue || "";

      // Calculate max length and expected length based on key size
      const keyMaxLength = React.useMemo(() => {
        const lengthMap = { 128: 32, 192: 48, 256: 64 };
        return lengthMap[keySize];
      }, [keySize]);

      // Real-time validation states
      const keyValidation = React.useMemo(
        () => getKeyValidationState(new EncryptionKeyInput(safeKeyValue, keyMaxLength)),
        [safeKeyValue, keyMaxLength]
      );
      const ivValidation = React.useMemo(() => getIVValidationState(new IVInput(safeIVValue)), [safeIVValue]);

      /**
       * Handle binary key file upload
       *
       * BINARY KEY FILE FORMAT:
       * - Byte 0: Key length (16, 24, or 32 bytes)
       * - Byte 1: IV length (0 for ECB, 16 for CBC/CTR)
       * - Bytes 2+: Key bits
       * - Bytes N+: IV bits (if present)
       *
       * This function:
       * 1. Parses the binary frame structure
       * 2. Validates against selected encryption mode
       * 3. Auto-detects key size from frame header
       * 4. Converts binary key/IV to hex for display
       * 5. Auto-populates all fields
       */
      const handleBinaryKeyFile = async (file: File) => {
        const arrayBuffer = await file.arrayBuffer();
        const bits = new Uint8Array(arrayBuffer);
        const keyData = parseBinaryKeyFile(bits);

        // Validate against selected mode (ensures IV requirements match)
        validateBinaryKeyFile(keyData, method);

        // Auto-detect key size from frame header (byte 0)
        const detectedKeySize = (keyData.key.length * 8) as KeySize;
        if (onKeySizeChange && detectedKeySize !== keySize) {
          onKeySizeChange(detectedKeySize);
        }

        // Convert binary key/IV to hex for display
        onKeyChange(bytesToHex(keyData.key));
        if (keyData.iv) {
          onIVChange(bytesToHex(keyData.iv));
        }

        setUploadedFileName(file.name);
      };

      /**
       * Handle JSON key file upload (legacy format)
       *
       * JSON KEY FILE FORMAT:
       * {
       *   "key": "hex string",
       *   "iv": "hex string" (optional),
       *   "method": "ECB" | "CBC" | "CTR",
       *   "timestamp": "ISO 8601 date",
       *   "version": "1.0"
       * }
       *
       * This format is maintained for backward compatibility but binary
       * key files are preferred for their compact size and frame structure.
       */
      const handleJsonKeyFile = async (file: File) => {
        const keyFileData = await parseKeyFile(file);

        onKeyChange(keyFileData.key);
        if (keyFileData.iv) {
          onIVChange(keyFileData.iv);
        }
        if (onMethodChange) {
          onMethodChange(keyFileData.method);
        }

        setUploadedFileName(file.name);
      };

      const isBinaryFile = (file: File): boolean => {
        return file.type === "application/octet-stream" || file.type === "" || !file.name.endsWith(".json");
      };

      const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
          if (isBinaryFile(file)) {
            await handleBinaryKeyFile(file);
          } else {
            await handleJsonKeyFile(file);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Invalid key file format. Expected binary key file or JSON with key, iv, and method fields";

          if (onError) {
            onError(errorMessage);
          }
          setUploadedFileName(null);
        }

        // Reset input to allow re-uploading the same file
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      };

      const handleGenerateKey = () => {
        const newKey = generateKey(keySize);
        onKeyChange(newKey);
        setUploadedFileName(null);
      };

      const handleGenerateIV = () => {
        const newIV = generateIV();
        onIVChange(newIV);
      };

      const handleKeyInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toLowerCase().replace(/[^0-9a-f]/g, "");
        onKeyChange(value);
        setUploadedFileName(null);
      };

      const handleIVInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toLowerCase().replace(/[^0-9a-f]/g, "");
        onIVChange(value);
      };

      return (
        <Card ref={ref} className={className}>
          <CardHeader>
            <CardTitle className="text-lg">Encryption Key</CardTitle>
            <CardDescription>Upload a key file or enter manually</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Upload Section */}
            {showFileUpload && (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="key-file-upload">
                  Key File
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    disabled={disabled}
                    className="flex-1 min-h-[44px]"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Key File
                  </Button>
                  <input
                    ref={fileInputRef}
                    id="key-file-upload"
                    type="file"
                    accept="*"
                    onChange={e => {
                      void handleFileUpload(e);
                    }}
                    className="hidden"
                    disabled={disabled}
                    aria-label="Upload binary or JSON key file"
                  />
                </div>
                {uploadedFileName && (
                  <div className="flex items-center gap-2 text-sm text-method-ctr">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="truncate">{uploadedFileName}</span>
                  </div>
                )}
              </div>
            )}

            {/* Key Size Selector */}
            {(showKeySizeSelector ?? showGenerate) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Key Size</label>
                <div className="flex gap-2">
                  {([128, 192, 256] as KeySize[]).map(size => (
                    <Button
                      key={size}
                      type="button"
                      variant={keySize === size ? "default" : "outline"}
                      onClick={() => onKeySizeChange?.(size)}
                      disabled={disabled}
                      className="flex-1 min-h-[44px]"
                      aria-pressed={keySize === size}
                      aria-label={`AES-${String(size)} (${String(size)}-bit)`}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Select the AES key size for encryption</p>
              </div>
            )}

            {/* Manual Key Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" htmlFor="key-input">
                  Key ({String(keySize)}-bit)
                </label>
                <span
                  className={cn(
                    "text-xs flex items-center gap-1",
                    (keyValue || "").length === keyMaxLength ? "text-method-ctr" : "text-muted-foreground"
                  )}
                >
                  {(keyValue || "").length === keyMaxLength && <CheckCircle2 className="h-3 w-3" />}
                  {(keyValue || "").length}/{keyMaxLength}
                </span>
              </div>
              <input
                id="key-input"
                type="text"
                value={keyValue || ""}
                onChange={handleKeyInputChange}
                placeholder={`Enter ${String(keyMaxLength)} hexadecimal characters`}
                disabled={disabled}
                maxLength={keyMaxLength}
                className={cn(
                  "w-full px-3 py-3 sm:py-2 text-base sm:text-sm font-mono rounded-md border bg-background min-h-[44px]",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  keyValue && !keyValidation.isValid && "border-destructive focus:ring-destructive"
                )}
                aria-label="Encryption key in hexadecimal format"
                aria-describedby="key-help key-validation"
                aria-invalid={(keyValue || "").length > 0 && !keyValidation.isValid}
              />
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p id="key-help" className="text-xs text-muted-foreground">
                    {String(keyMaxLength)} hexadecimal characters (0-9, a-f)
                  </p>
                  {keyValue && !keyValidation.isValid && keyValidation.error && (
                    <p id="key-validation" className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {keyValidation.error}
                    </p>
                  )}
                </div>
                {showGenerate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateKey}
                    disabled={disabled}
                    className="h-9 sm:h-7 text-xs min-w-[88px] sm:min-w-0"
                  >
                    <Dices className="h-3 w-3 mr-1" />
                    Generate
                  </Button>
                )}
              </div>
            </div>

            {/* IV Input (conditional) */}
            {needsIV && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" htmlFor="iv-input">
                    Initialization Vector (IV)
                  </label>
                  <span
                    className={cn(
                      "text-xs flex items-center gap-1",
                      ivValidation.isComplete ? "text-method-ctr" : "text-muted-foreground"
                    )}
                  >
                    {ivValidation.isComplete && <CheckCircle2 className="h-3 w-3" />}
                    {(ivValue || "").length}/32
                  </span>
                </div>
                <input
                  id="iv-input"
                  type="text"
                  value={ivValue || ""}
                  onChange={handleIVInputChange}
                  placeholder="Enter 32 hexadecimal characters"
                  disabled={disabled}
                  maxLength={32}
                  className={cn(
                    "w-full px-3 py-3 sm:py-2 text-base sm:text-sm font-mono rounded-md border bg-background min-h-[44px]",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    ivValue && !ivValidation.isValid && "border-destructive focus:ring-destructive"
                  )}
                  aria-label="Initialization vector in hexadecimal format"
                  aria-describedby="iv-help iv-validation"
                  aria-invalid={(ivValue || "").length > 0 && !ivValidation.isValid}
                />
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p id="iv-help" className="text-xs text-muted-foreground">
                      32 hexadecimal characters (0-9, a-f)
                    </p>
                    {ivValue && !ivValidation.isValid && ivValidation.error && (
                      <p id="iv-validation" className="text-xs text-destructive flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {ivValidation.error}
                      </p>
                    )}
                  </div>
                  {showGenerate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateIV}
                      disabled={disabled}
                      className="h-9 sm:h-7 text-xs min-w-[88px] sm:min-w-0"
                    >
                      <Dices className="h-3 w-3 mr-1" />
                      Generate
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }
  )
);

KeyInputSection.displayName = "KeyInputSection";
