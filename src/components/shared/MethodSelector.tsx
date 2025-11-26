import * as React from "react";
import { Lock, Link2, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { EncryptionMethod } from "@/types/store.types";

export interface MethodSelectorProps {
  method: EncryptionMethod;
  onMethodChange: (method: EncryptionMethod) => void;
  disabled?: boolean;
  className?: string;
}

interface MethodOption {
  value: EncryptionMethod;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: {
    border: string;
    bg: string;
    text: string;
  };
}

const METHOD_OPTIONS: MethodOption[] = [
  {
    value: "ECB",
    label: "ECB (Electronic Code-book)",
    shortLabel: "ECB",
    description: "Block mode - shows patterns in encrypted images",
    icon: Lock,
    color: {
      border: "border-method-ecb",
      bg: "bg-method-ecb/10",
      text: "text-method-ecb",
    },
  },
  {
    value: "CBC",
    label: "CBC (Cipher Block Chaining)",
    shortLabel: "CBC",
    description: "Chained blocks - randomized appearance with IV",
    icon: Link2,
    color: {
      border: "border-method-cbc",
      bg: "bg-method-cbc/10",
      text: "text-method-cbc",
    },
  },
  {
    value: "CTR",
    label: "CTR (Counter)",
    shortLabel: "CTR",
    description: "Counter mode - stream cipher behavior",
    icon: Radio,
    color: {
      border: "border-method-ctr",
      bg: "bg-method-ctr/10",
      text: "text-method-ctr",
    },
  },
];

export const MethodSelector = React.memo(
  React.forwardRef<HTMLDivElement, MethodSelectorProps>(
    ({ method, onMethodChange, disabled = false, className }, ref) => {
      return (
        <Card ref={ref} className={className}>
          <CardHeader>
            <Tooltip content="Select AES-256 encryption mode">
              <CardTitle className="text-lg cursor-help inline-block" id="encryption-method-label">
                Encryption Method
              </CardTitle>
            </Tooltip>
          </CardHeader>
          <CardContent>
            <fieldset className="flex flex-row gap-4 justify-between" aria-labelledby="encryption-method-label">
              <legend className="sr-only">Choose encryption method</legend>
              {METHOD_OPTIONS.map(option => {
                const Icon = option.icon;
                const isSelected = method === option.value;

                return (
                  <Tooltip
                    key={option.value}
                    content={option.description}
                    className="w-[250px]"
                    containerClassName="flex-1"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onMethodChange(option.value);
                      }}
                      disabled={disabled}
                      className={cn(
                        "w-full min-w-[80px] min-h-[5.5rem] relative cursor-pointer rounded-lg border-2 p-4 transition-all duration-200",
                        "hover:shadow-md focus:ring-2 focus:ring-ring focus:ring-offset-2",
                        "hover:scale-[1.02]",
                        isSelected && [option.color.border, option.color.bg, "shadow-sm"],
                        !isSelected && "border-border hover:border-muted-foreground/50",
                        disabled && "cursor-not-allowed opacity-50"
                      )}
                      aria-label={`${option.label}: ${option.description}`}
                      aria-pressed={isSelected}
                    >
                      <div className="flex flex-col items-center text-center gap-2">
                        <Icon
                          className={cn(
                            "h-6 w-6 transition-colors",
                            isSelected ? option.color.text : "text-muted-foreground"
                          )}
                          aria-hidden="true"
                        />
                        <p className={cn("text-sm font-semibold transition-colors", isSelected && option.color.text)}>
                          {option.shortLabel}
                        </p>
                      </div>

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
      );
    }
  )
);

MethodSelector.displayName = "MethodSelector";
