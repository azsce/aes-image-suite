import { ChevronDown } from "lucide-react";
import type { ActiveTab } from "@/types/store.types";

interface Tab {
  id: ActiveTab;
  label: string;
  shortcut: string;
}

interface MobileTabMenuProps {
  readonly tabs: readonly Tab[];
  readonly activeTab: ActiveTab;
  readonly activeTabLabel: string;
  readonly showMobileMenu: boolean;
  readonly onToggleMenu: () => void;
  readonly onSelectTab: (tabId: ActiveTab) => void;
  readonly onCloseMenu: () => void;
}

export function MobileTabMenu({
  tabs,
  activeTab,
  activeTabLabel,
  showMobileMenu,
  onToggleMenu,
  onSelectTab,
  onCloseMenu,
}: MobileTabMenuProps) {
  return (
    <div className="relative md:hidden">
      <button
        onClick={onToggleMenu}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-900 dark:text-gray-100 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        aria-label="Select mode"
        aria-expanded={showMobileMenu}
      >
        {activeTabLabel}
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>

      {showMobileMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={onCloseMenu} aria-hidden="true" />
          <div className="absolute left-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 py-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  onSelectTab(tab.id);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  tab.id === activeTab
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="flex items-center justify-between">
                  {tab.label}
                  <kbd className="px-1.5 py-0.5 text-xs font-mono bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-600">
                    {tab.shortcut}
                  </kbd>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
