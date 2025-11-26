/* eslint-disable no-console */

import { useState } from "react";
import type { ErrorInfo } from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home, Copy, Check } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface TypedFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function DefaultErrorFallback({ error, resetErrorBoundary }: Readonly<TypedFallbackProps>) {
  const [copied, setCopied] = useState(false);

  const handleCopyError = () => {
    const errorText = [
      `Error: ${error.name}`,
      `Message: ${error.message}`,
      "",
      "Stack Trace:",
      error.stack || "No stack trace available",
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard
      .writeText(errorText)
      .then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      })
      .catch(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      });
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full space-y-6">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="h-8 w-8" />
          <h1 className="text-2xl font-bold">Something went wrong</h1>
        </div>

        <div className="bg-muted p-4 rounded-lg border border-border">
          <p className="font-semibold text-foreground mb-2">
            {error.name}: {error.message}
          </p>
          {import.meta.env.DEV && error.stack && (
            <pre className="text-xs text-muted-foreground overflow-auto max-h-64 mt-2">{error.stack}</pre>
          )}
        </div>

        <div className="flex gap-3 flex-wrap">
          <Button onClick={resetErrorBoundary} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button onClick={handleReload} variant="outline" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Reload Page
          </Button>
          <Button onClick={handleCopyError} variant="secondary" className="flex items-center gap-2">
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Error
              </>
            )}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          If this problem persists, please try clearing your browser cache or contact support.
        </p>
      </div>
    </div>
  );
}

export function ErrorBoundary({ children, fallback, onError }: Readonly<ErrorBoundaryProps>) {
  const handleError = (error: Error, info: ErrorInfo) => {
    if (import.meta.env.DEV) {
      console.error("Error Boundary caught an error:", error, info);
    }
    onError?.(error, info);
  };

  const FallbackComponent = fallback
    ? ({ error, resetErrorBoundary }: Readonly<TypedFallbackProps>) => fallback(error, resetErrorBoundary)
    : DefaultErrorFallback;

  return (
    <ReactErrorBoundary FallbackComponent={FallbackComponent} onError={handleError}>
      {children}
    </ReactErrorBoundary>
  );
}
