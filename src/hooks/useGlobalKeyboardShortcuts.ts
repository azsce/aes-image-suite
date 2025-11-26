import { useEffect } from "react";
import type { ActiveTab } from "@/types/store.types";

function isInputElement(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function getTabFromKey(key: string): ActiveTab | null {
  switch (key) {
    case "1":
      return "encryption";
    case "2":
      return "decryption";
    case "3":
      return "comparison";
    default:
      return null;
  }
}

export function useGlobalKeyboardShortcuts(setActiveTab: (tab: ActiveTab) => void) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (isInputElement(event.target)) {
        return;
      }

      const tab = getTabFromKey(event.key);
      if (tab) {
        setActiveTab(tab);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [setActiveTab]);
}
