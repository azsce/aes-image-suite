import { memo, useState, useCallback, useEffect, useMemo } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Lock } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useScreenReaderAnnouncement } from "@/hooks/useScreenReaderAnnouncement";
import { useTabKeyboardNavigation } from "@/hooks/useTabKeyboardNavigation";
import { useGlobalKeyboardShortcuts } from "@/hooks/useGlobalKeyboardShortcuts";
import { MobileTabMenu } from "@/components/layout/MobileTabMenu";
import { DesktopTabs } from "@/components/layout/DesktopTabs";
import { KeyboardShortcutsMenu } from "@/components/layout/KeyboardShortcutsMenu";
import type { ActiveTab } from "@/types/store.types";

const tabs = [
  { id: "encryption" as ActiveTab, label: "Encryption", shortcut: "1" },
  { id: "decryption" as ActiveTab, label: "Decryption", shortcut: "2" },
  { id: "comparison" as ActiveTab, label: "Comparison", shortcut: "3" },
] as const;

export const AppHeader = memo(function AppHeader() {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const activeTab = useAppStore(state => state.activeTab);
  const setActiveTab = useAppStore(state => state.setActiveTab);
  const { announce } = useScreenReaderAnnouncement();

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const { handleKeyDown } = useTabKeyboardNavigation(tabs, activeTab, setActiveTab);
  useGlobalKeyboardShortcuts(setActiveTab);

  const handleToggleShortcuts = useCallback(() => {
    setShowShortcuts(prev => !prev);
  }, []);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setShowShortcuts(false);
    }, 200);
  }, []);

  const handleMobileTabSelect = useCallback(
    (tabId: ActiveTab) => {
      setActiveTab(tabId);
      setShowMobileMenu(false);
    },
    [setActiveTab]
  );

  const handleToggleMobileMenu = useCallback(() => {
    setShowMobileMenu(prev => !prev);
  }, []);

  const handleCloseMobileMenu = useCallback(() => {
    setShowMobileMenu(false);
  }, []);

  // Announce tab changes to screen readers
  useEffect(() => {
    const tabLabel = tabs.find(tab => tab.id === activeTab)?.label;
    if (tabLabel) {
      announce(`${tabLabel} mode selected`, "polite");
    }
  }, [activeTab, announce]);

  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
  const activeTabLabel = tabs.find(tab => tab.id === activeTab)?.label || "";

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-950" role="banner">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Lock className="h-5 w-5 md:h-6 md:w-6 text-primary flex-shrink-0" aria-hidden="true" />

            <h1 className="hidden lg:block text-xl font-bold text-slate-900 dark:text-gray-100 whitespace-nowrap">
              AES Image Encryption Suite
            </h1>

            <MobileTabMenu
              tabs={tabs}
              activeTab={activeTab}
              activeTabLabel={activeTabLabel}
              showMobileMenu={showMobileMenu}
              onToggleMenu={handleToggleMobileMenu}
              onSelectTab={handleMobileTabSelect}
              onCloseMenu={handleCloseMobileMenu}
            />

            <DesktopTabs
              tabs={tabs}
              activeTab={activeTab}
              activeIndex={activeIndex}
              prefersReducedMotion={prefersReducedMotion}
              onSelectTab={setActiveTab}
              onKeyDown={handleKeyDown}
            />
          </div>

          <nav aria-label="Header controls" className="flex items-center gap-2 flex-shrink-0">
            <KeyboardShortcutsMenu
              showShortcuts={showShortcuts}
              onToggle={handleToggleShortcuts}
              onBlur={handleBlur}
            />
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
});
