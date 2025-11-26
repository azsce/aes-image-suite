import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  children: React.ReactElement;
  content: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export const Tooltip = ({ children, content, className, containerClassName }: TooltipProps) => {
  const [isVisible, setIsVisible] = React.useState(false);

  const handleMouseEnter = () => {
    setIsVisible(true);
  };
  const handleMouseLeave = () => {
    setIsVisible(false);
  };
  const handleFocus = () => {
    setIsVisible(true);
  };
  const handleBlur = () => {
    setIsVisible(false);
  };

  return (
    <div className={cn("relative inline-block", containerClassName)}>
      {React.cloneElement(children, {
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        onFocus: handleFocus,
        onBlur: handleBlur,
      } as React.HTMLAttributes<HTMLElement>)}
      {isVisible && (
        <div
          className={cn(
            "absolute z-50 px-3 py-2 text-sm text-popover-foreground bg-popover border border-border rounded-md shadow-md",
            "bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-normal",
            "animate-in fade-in-0 zoom-in-95",
            className
          )}
          role="tooltip"
        >
          {content}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border" />
        </div>
      )}
    </div>
  );
};
