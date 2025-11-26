import * as React from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ComparisonResult as ComparisonResultType } from "@/types/store.types";

const getDifferenceColor = (percentage: number): string => {
  if (percentage < 1) {
    return "font-semibold text-yellow-600 dark:text-yellow-500";
  }
  if (percentage < 10) {
    return "font-semibold text-orange-600 dark:text-orange-500";
  }
  return "font-semibold text-destructive";
};

export interface ComparisonResultProps {
  result: ComparisonResultType | null;
  className?: string;
}

export const ComparisonResult = React.memo(
  React.forwardRef<HTMLDivElement, ComparisonResultProps>(({ result, className }, ref) => {
    if (!result) {
      return null;
    }

    const { identical, differencePercentage, sizeMismatch, differenceCount, totalBits, details } = result;

    const getStatusConfig = () => {
      if (identical) {
        return {
          icon: CheckCircle2,
          iconColor: "text-method-ctr",
          bgColor: "bg-method-ctr/10",
          borderColor: "border-method-ctr",
          title: "Files are identical",
          description: "100% bit-perfect match - files are identical at the bit level.",
        };
      }

      if (sizeMismatch) {
        return {
          icon: AlertTriangle,
          iconColor: "text-orange-600 dark:text-orange-500",
          bgColor: "bg-orange-50 dark:bg-orange-950/30",
          borderColor: "border-orange-500 dark:border-orange-700",
          title: "Size mismatch",
          description: details,
        };
      }

      return {
        icon: AlertTriangle,
        iconColor: "text-destructive",
        bgColor: "bg-destructive/10",
        borderColor: "border-destructive",
        title: "Files differ",
        description: details,
      };
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    return (
      <Card
        ref={ref}
        className={cn("border-2 transition-colors", config.borderColor, config.bgColor, className)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className={cn("flex-shrink-0 mt-0.5", config.iconColor)}>
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold mb-1">{config.title}</h3>
              <p className="text-sm text-muted-foreground mb-3">{config.description}</p>

              {/* Detailed Information */}
              {!identical && (
                <div className="space-y-2 text-sm">
                  {!sizeMismatch && (
                    <>
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span>
                          <span className="font-medium">Difference: </span>
                          <span className={getDifferenceColor(differencePercentage)}>
                            {differencePercentage.toFixed(4)}%
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span>
                          <span className="font-medium">Differing bits: </span>
                          <span className="font-mono">{differenceCount.toLocaleString()}</span>
                          <span className="text-muted-foreground"> of </span>
                          <span className="font-mono">{totalBits.toLocaleString()}</span>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  })
);

ComparisonResult.displayName = "ComparisonResult";
