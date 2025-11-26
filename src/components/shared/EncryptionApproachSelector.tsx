import * as React from "react";
import { Info } from "lucide-react";
import type { EncryptionMethodType } from "@/types/encryption-method.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { InfoDialog } from "./InfoDialog";
import penguinContent from "@/content/where_is_penguin.md?raw";

interface EncryptionApproachSelectorProps {
  readonly selectedMethod: EncryptionMethodType;
  readonly onMethodChange: (method: EncryptionMethodType) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

interface ApproachOption {
  value: EncryptionMethodType;
  label: string;
  shortLabel: string;
  description: string;
  color: {
    border: string;
    bg: string;
    text: string;
  };
}

const APPROACH_OPTIONS: ApproachOption[] = [
  {
    value: "pixel-data",
    label: "Preserve Patterns (Insecure)",
    shortLabel: "Pixel",
    description: "Encrypt pixel data only (BMP)",
    color: {
      border: "border-blue-500",
      bg: "bg-blue-500/10",
      text: "text-blue-500",
    },
  },
  {
    value: "whole-file",
    label: "Encrypt Whole File",
    shortLabel: "Whole",
    description: "Standard security approach",
    color: {
      border: "border-blue-500",
      bg: "bg-blue-500/10",
      text: "text-blue-500",
    },
  },
];

export const EncryptionApproachSelector = React.memo(
  React.forwardRef<HTMLDivElement, EncryptionApproachSelectorProps>(
    ({ selectedMethod, onMethodChange, disabled = false, className }, ref) => {
      const [dialogOpen, setDialogOpen] = React.useState(false);
      const [dialogContent, setDialogContent] = React.useState<{
        title: string;
        content: string;
      } | null>(null);

      const handleInfoClick = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setDialogContent({
          title: "Encryption Approaches",
          content: penguinContent,
        });
        setDialogOpen(true);
      }, []);

      return (
        <>
          <Card ref={ref} className={className}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Tooltip content="Choose how to encrypt your image">
                  <CardTitle className="text-lg cursor-help inline-block" id="encryption-approach-label">
                    Encryption Approach
                  </CardTitle>
                </Tooltip>
                <button
                  type="button"
                  onClick={handleInfoClick}
                  className="p-1 rounded-full hover:bg-muted/50 transition-colors"
                  aria-label="Learn more about encryption approaches"
                  disabled={disabled}
                >
                  <Info className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <fieldset className="w-full flex flex-row gap-4" aria-labelledby="encryption-approach-label">
                <legend className="sr-only">Choose encryption approach</legend>
                {APPROACH_OPTIONS.map(option => {
                  const isSelected = selectedMethod === option.value;

                  return (
                    <Tooltip
                      key={option.value}
                      content={option.description}
                      className="w-[250px]"
                      containerClassName="flex-1 min-w-[40%]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onMethodChange(option.value);
                        }}
                        disabled={disabled}
                        className={cn(
                          "w-full relative cursor-pointer rounded-lg border-2 p-4 transition-all duration-200",
                          "min-h-[5.5rem] flex items-center",
                          "hover:shadow-md focus:ring-2 focus:ring-ring focus:ring-offset-2",
                          "hover:scale-[1.02]",
                          isSelected && [option.color.border, option.color.bg, "shadow-sm"],
                          !isSelected && "border-border hover:border-muted-foreground/50",
                          disabled && "cursor-not-allowed opacity-50"
                        )}
                        aria-label={`${option.label}: ${option.description}`}
                        aria-pressed={isSelected}
                      >
                        <p
                          className={cn(
                            "text-sm font-semibold transition-colors text-left",
                            isSelected && option.color.text
                          )}
                        >
                          {option.label}
                        </p>

                        {/* Selection indicator */}
                        {isSelected && (
                          <div
                            className={cn(
                              "absolute top-2 right-2 h-2 w-2 rounded-full",
                              option.color.border.replace("border-", "bg-")
                            )}
                          />
                        )}
                      </button>
                    </Tooltip>
                  );
                })}
              </fieldset>
            </CardContent>
          </Card>

          {dialogContent && (
            <InfoDialog
              isOpen={dialogOpen}
              onClose={() => {
                setDialogOpen(false);
              }}
              title={dialogContent.title}
              content={dialogContent.content}
            />
          )}
        </>
      );
    }
  )
);

EncryptionApproachSelector.displayName = "EncryptionApproachSelector";
