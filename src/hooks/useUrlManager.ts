import { useRef, useCallback, useEffect } from "react";

/**
 * Manages object URLs lifecycle to prevent memory leaks
 */
export function useUrlManager() {
  const urlsRef = useRef<string[]>([]);

  const revokeAllUrls = useCallback(() => {
    urlsRef.current.forEach(url => {
      URL.revokeObjectURL(url);
    });
    urlsRef.current = [];
  }, []);

  const revokeUrl = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    const index = urlsRef.current.indexOf(url);
    if (index > -1) {
      urlsRef.current.splice(index, 1);
    }
  }, []);

  const addUrl = useCallback((url: string) => {
    urlsRef.current.push(url);
  }, []);

  useEffect(() => {
    return () => {
      revokeAllUrls();
    };
  }, [revokeAllUrls]);

  return { revokeAllUrls, revokeUrl, addUrl };
}
