import { useCallback } from "react";
import type { ActiveTab } from "@/types/store.types";

interface Tab {
  id: ActiveTab;
  label: string;
  shortcut: string;
}

export function useTabKeyboardNavigation(tabs: readonly Tab[], activeTab: ActiveTab, setActiveTab: (tab: ActiveTab) => void) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTab);

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          if (currentIndex > 0) {
            setActiveTab(tabs[currentIndex - 1].id);
          }
          break;
        case "ArrowRight":
          event.preventDefault();
          if (currentIndex < tabs.length - 1) {
            setActiveTab(tabs[currentIndex + 1].id);
          }
          break;
        case "Home":
          event.preventDefault();
          setActiveTab(tabs[0].id);
          break;
        case "End":
          event.preventDefault();
          setActiveTab(tabs[tabs.length - 1].id);
          break;
      }
    },
    [tabs, activeTab, setActiveTab]
  );

  return { handleKeyDown };
}
