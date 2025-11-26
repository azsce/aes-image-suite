/**
 * ErrorAlert component for displaying error messages with auto-dismiss and recovery suggestions
 */

import { memo, useEffect, useMemo } from "react";
import { AlertCircle, X, Info } from "lucide-react";

interface ErrorAlertProps {
  readonly error: string | null;
  readonly onDismiss: () => void;
  readonly autoDismiss?: boolean;
  readonly duration?: number;
}

interface ErrorPattern {
  keywords: string[];
  suggestion: string;
  requiresAll?: boolean;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    keywords: ["invalid key file", "key size in file"],
    suggestion:
      "Ensure you're uploading the correct binary key file generated during encryption. The file should have no extension.",
  },
  {
    keywords: ["key file: expected", "bytes"],
    suggestion:
      "The key file appears to be corrupted or incomplete. Try re-downloading the key file from the encryption step.",
    requiresAll: true,
  },
  {
    keywords: ["unsupported key size"],
    suggestion:
      "This application currently supports only AES-256 (256-bit keys). Please use a 256-bit key or generate a new one.",
  },
  {
    keywords: ["mode requires iv", "mode does not use iv"],
    suggestion:
      "The key file doesn't match the selected encryption mode. Verify you've selected the same mode used during encryption (ECB, CBC, or CTR).",
  },
  {
    keywords: ["requires an initialization vector"],
    suggestion:
      "CBC and CTR modes require an IV. Either provide an IV or switch to ECB mode (note: ECB is less secure).",
  },
  {
    keywords: ["does not use an initialization vector"],
    suggestion: "ECB mode doesn't use an IV. Remove the IV value or switch to CBC/CTR mode for better security.",
  },
  {
    keywords: ["mime type", "not an image"],
    suggestion: "Please upload a valid image file (PNG, JPEG, WebP, GIF, etc.). Ensure the file isn't corrupted.",
  },
  {
    keywords: ["padding", "decrypt"],
    suggestion: "Decryption failed. Verify that the key, IV, and encryption mode match those used during encryption.",
  },
  {
    keywords: ["bits differ", "not identical"],
    suggestion:
      "The files are not bit-perfect matches. This may indicate data loss during encryption/decryption or file corruption.",
  },
  {
    keywords: ["file size", "exceed"],
    suggestion: "Reduce the image file size or resolution before encrypting. Maximum supported size is 30MB.",
    requiresAll: true,
  },
  {
    keywords: ["corrupted", "malformed"],
    suggestion: "The file appears to be damaged. Try re-saving the image or using a different file format.",
  },
];

function matchesPattern(errorLower: string, pattern: ErrorPattern): boolean {
  if (pattern.requiresAll) {
    return pattern.keywords.every(keyword => errorLower.includes(keyword));
  }
  return pattern.keywords.some(keyword => errorLower.includes(keyword));
}

/**
 * Extracts error recovery suggestions based on error message content
 */
function getErrorRecoverySuggestion(error: string): string | null {
  const errorLower = error.toLowerCase();

  const matchedPattern = ERROR_PATTERNS.find(pattern => matchesPattern(errorLower, pattern));

  return matchedPattern ? matchedPattern.suggestion : null;
}

export const ErrorAlert = memo(function ErrorAlert({
  error,
  onDismiss,
  autoDismiss = true,
  duration = 5000,
}: ErrorAlertProps) {
  const recoverySuggestion = useMemo(() => {
    if (!error) return null;
    return getErrorRecoverySuggestion(error);
  }, [error]);

  useEffect(() => {
    if (error && autoDismiss) {
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [error, autoDismiss, duration, onDismiss]);

  if (!error) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-in slide-in-from-top-4 fade-in duration-300"
    >
      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 dark:border-red-400 rounded-lg p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800 dark:text-red-200 break-words mb-2">{error}</p>
            {recoverySuggestion && (
              <div className="flex items-start gap-2 mt-2 pt-2 border-t border-red-300 dark:border-red-700">
                <Info className="w-4 h-4 text-red-600 dark:text-red-300 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-300 break-words">{recoverySuggestion}</p>
              </div>
            )}
          </div>
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
});
