import * as React from "react";
import { Download, Key, Archive, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DownloadVariant = "image" | "key" | "bundle";

export interface DownloadButtonProps {
  variant: DownloadVariant;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  shortcut?: string;
}

interface VariantConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  ariaLabel: string;
}

const VARIANT_CONFIG: Record<DownloadVariant, VariantConfig> = {
  image: {
    icon: Download,
    label: "Download Image",
    ariaLabel: "Download encrypted or decrypted image",
  },
  key: {
    icon: Key,
    label: "Download Key",
    ariaLabel: "Download encryption key file",
  },
  bundle: {
    icon: Archive,
    label: "Download Bundle",
    ariaLabel: "Download bundle containing image and key file",
  },
};

export const DownloadButton = React.memo(
  React.forwardRef<HTMLButtonElement, DownloadButtonProps>(
    ({ variant, onClick, disabled = false, className, shortcut }, ref) => {
      const [showSuccess, setShowSuccess] = React.useState(false);
      const config = VARIANT_CONFIG[variant];
      const Icon = showSuccess ? CheckCircle : config.icon;

      const prefersReducedMotion = React.useMemo(() => {
        if (typeof window === "undefined") return false;
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      }, []);

      const handleClick = React.useCallback(() => {
        onClick();

        // Show success animation
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
        }, 2000);
      }, [onClick]);

      // Handle keyboard shortcut
      React.useEffect(() => {
        if (!shortcut || disabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
          const isCtrlOrCmd = e.ctrlKey || e.metaKey;
          const key = e.key.toLowerCase();

          if (isCtrlOrCmd && key === shortcut.toLowerCase()) {
            e.preventDefault();
            handleClick();
          }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
          window.removeEventListener("keydown", handleKeyDown);
        };
      }, [shortcut, disabled, handleClick]);

      return (
        <Button
          ref={ref}
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className={cn(
            "relative transition-all duration-200 min-h-[44px] px-4 sm:px-3 py-3 sm:py-2",
            showSuccess && "bg-method-ctr hover:bg-method-ctr",
            className
          )}
          aria-label={config.ariaLabel}
        >
          <Icon
            className={cn(
              "h-4 w-4 mr-2",
              !prefersReducedMotion && "transition-transform",
              !prefersReducedMotion && showSuccess && "scale-110"
            )}
          />
          <span>{config.label}</span>
          {shortcut && !disabled && (
            <span className="ml-2 text-xs opacity-60">
              ({navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+{shortcut.toUpperCase()})
            </span>
          )}
        </Button>
      );
    }
  )
);

DownloadButton.displayName = "DownloadButton";
