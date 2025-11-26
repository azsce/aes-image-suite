/**
 * Hook for making screen reader announcements
 * Creates a live region for announcing dynamic content changes
 */

import { useEffect, useRef } from "react";

type AnnouncementPriority = "polite" | "assertive";

export function useScreenReaderAnnouncement() {
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create live region if it doesn't exist
    if (!liveRegionRef.current) {
      const liveRegion = document.createElement("div");
      liveRegion.setAttribute("role", "status");
      liveRegion.setAttribute("aria-live", "polite");
      liveRegion.setAttribute("aria-atomic", "true");
      liveRegion.className = "sr-only";
      document.body.appendChild(liveRegion);
      liveRegionRef.current = liveRegion;
    }

    return () => {
      if (liveRegionRef.current) {
        document.body.removeChild(liveRegionRef.current);
        liveRegionRef.current = null;
      }
    };
  }, []);

  const announce = (message: string, priority: AnnouncementPriority = "polite") => {
    if (!liveRegionRef.current) return;

    // Update aria-live priority
    liveRegionRef.current.setAttribute("aria-live", priority);

    // Clear and set new message
    liveRegionRef.current.textContent = "";
    setTimeout(() => {
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = message;
      }
    }, 100);
  };

  return { announce };
}
