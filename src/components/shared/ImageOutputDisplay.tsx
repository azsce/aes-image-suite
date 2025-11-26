import * as React from "react";
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchContentRef } from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ImageOutputDisplayProps {
  imageUrl: string | null;
  placeholderText?: string;
  isLoading?: boolean;
  loadingText?: string;
  height?: "mobile" | "tablet" | "desktop";
  className?: string;
}

const HEIGHT_MAP = {
  mobile: "h-[200px]",
  tablet: "h-[280px]",
  desktop: "h-[350px]",
} as const;

const getContainerClasses = (height: "mobile" | "tablet" | "desktop") => {
  return cn(
    "relative border border-border rounded-md overflow-hidden",
    HEIGHT_MAP[height],
    "bg-[linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%,hsl(var(--muted))),linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%,hsl(var(--muted)))]",
    "bg-[length:20px_20px] bg-[position:0_0,10px_10px]"
  );
};

export const ImageOutputDisplay = React.memo(
  React.forwardRef<HTMLDivElement, ImageOutputDisplayProps>(
    (
      {
        imageUrl,
        placeholderText = "Processed image will appear here",
        isLoading = false,
        loadingText = "Processing...",
        height = "desktop",
        className,
      },
      ref
    ) => {
      const [zoomLevel, setZoomLevel] = React.useState(1);
      const [isImageLoaded, setIsImageLoaded] = React.useState(false);
      const transformWrapperRef = React.useRef<ReactZoomPanPinchContentRef>(null);
      const imageRef = React.useRef<HTMLImageElement>(null);

      // Reset loaded state when url changes
      React.useEffect(() => {
        setIsImageLoaded(false);
      }, [imageUrl]);

      const fitToContainer = React.useCallback((animationTime = 200) => {
        if (!transformWrapperRef.current || !imageRef.current) return;

        const { wrapperComponent } = transformWrapperRef.current.instance;
        const img = imageRef.current;

        if (!wrapperComponent) return;

        // Use requestAnimationFrame to ensure we have the latest layout
        requestAnimationFrame(() => {
          const wrapperWidth = wrapperComponent.clientWidth;
          const wrapperHeight = wrapperComponent.clientHeight;
          const imgWidth = img.naturalWidth;
          const imgHeight = img.naturalHeight;

          if (!imgWidth || !imgHeight) return;

          const scaleX = wrapperWidth / imgWidth;
          const scaleY = wrapperHeight / imgHeight;
          const scale = Math.min(scaleX, scaleY);

          // Calculate centered position
          const x = (wrapperWidth - imgWidth * scale) / 2;
          const y = (wrapperHeight - imgHeight * scale) / 2;

          if (transformWrapperRef.current) {
            transformWrapperRef.current.setTransform(x, y, scale, animationTime);
            setZoomLevel(scale);
          }
        });
      }, []);

      // Trigger fit when image is loaded
      React.useEffect(() => {
        if (isImageLoaded) {
          // Small delay to ensure layout is finalized
          const timer = setTimeout(() => {
            fitToContainer(0);
          }, 50);
          return () => {
            clearTimeout(timer);
          };
        }
      }, [isImageLoaded, fitToContainer]);

      const getAltText = () => "Image viewer content";

      const handleZoomIn = () => {
        if (transformWrapperRef.current) {
          transformWrapperRef.current.zoomIn(0.25);
        }
      };

      const handleZoomOut = () => {
        if (transformWrapperRef.current) {
          transformWrapperRef.current.zoomOut(0.25);
        }
      };

      const handleReset = React.useCallback(() => {
        fitToContainer();
      }, [fitToContainer]);

      const handleTransform = React.useCallback((transformRef: ReactZoomPanPinchContentRef) => {
        setZoomLevel(transformRef.instance.transformState.scale);
      }, []);

      // Keyboard shortcuts for zoom controls
      React.useEffect(() => {
        if (!imageUrl) return;

        const handleKeyDown = (e: KeyboardEvent) => {
          // Only handle if the image viewer or its controls are focused
          const target = e.target as HTMLElement;
          const isInViewer = target.closest('[role="region"]') !== null;

          if (!isInViewer) return;

          switch (e.key) {
            case "+":
            case "=":
              e.preventDefault();
              handleZoomIn();
              break;
            case "-":
            case "_":
              e.preventDefault();
              handleZoomOut();
              break;
            case "0":
              e.preventDefault();
              handleReset();
              break;
          }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
          window.removeEventListener("keydown", handleKeyDown);
        };
      }, [imageUrl, handleReset]);

      return (
        <Card ref={ref} className={cn("overflow-hidden", className)}>
          <CardContent className="p-4">
            <div
              className={getContainerClasses(height)}
              role="region"
              aria-label="Image viewer with zoom and pan controls"
              tabIndex={imageUrl ? 0 : -1}
            >
              {isLoading && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-background/80">
                  <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-muted-foreground animate-pulse">{loadingText}</p>
                </div>
              )}
              {!isLoading && imageUrl && (
                <>
                  <TransformWrapper
                    ref={transformWrapperRef}
                    initialScale={1}
                    minScale={0.01}
                    maxScale={100}
                    centerZoomedOut={true}
                    wheel={{ step: 0.1 }}
                    doubleClick={{ mode: "reset" }}
                    panning={{ disabled: false }}
                    onTransformed={handleTransform}
                  >
                    <TransformComponent
                      wrapperClass="w-full h-full"
                      contentClass=""
                    >
                      <img
                        ref={imageRef}
                        src={imageUrl}
                        alt={getAltText()}
                        className="pixelated object-contain"
                        role="img"
                        loading="lazy"
                        onLoad={() => {
                          setIsImageLoaded(true);
                        }}
                      />
                    </TransformComponent>
                  </TransformWrapper>

                  {/* Zoom Controls Overlay */}
                  <div className="absolute bottom-3 right-3 flex flex-col gap-1 bg-background/90 backdrop-blur-sm rounded-md p-1 shadow-lg border border-border">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleZoomIn}
                      className="h-11 w-11 sm:h-8 sm:w-8"
                      aria-label="Zoom in"
                      type="button"
                    >
                      <ZoomIn className="h-5 w-5 sm:h-4 sm:w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleZoomOut}
                      className="h-11 w-11 sm:h-8 sm:w-8"
                      aria-label="Zoom out"
                      type="button"
                    >
                      <ZoomOut className="h-5 w-5 sm:h-4 sm:w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleReset}
                      className="h-11 w-11 sm:h-8 sm:w-8"
                      aria-label="Reset zoom"
                      type="button"
                    >
                      <RotateCcw className="h-5 w-5 sm:h-4 sm:w-4" />
                    </Button>
                    <div className="text-[10px] text-center text-muted-foreground px-1 py-0.5">
                      {Math.round(zoomLevel * 100)}%
                    </div>
                  </div>
                </>
              )}
              {!isLoading && !imageUrl && (
                <div
                  className="w-full h-full flex items-center justify-center text-muted-foreground bg-background/50"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-sm">{placeholderText}</p>
                </div>
              )}
            </div>
            <p className="sr-only">
              Use mouse wheel to zoom, click and drag to pan, double-click to reset view. Keyboard shortcuts: Plus or
              Equals to zoom in, Minus to zoom out, Zero to reset zoom.
            </p>
          </CardContent>
        </Card>
      );
    }
  )
);

ImageOutputDisplay.displayName = "ImageOutputDisplay";
