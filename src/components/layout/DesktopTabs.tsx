import type { ActiveTab } from "@/types/store.types";

interface Tab {
  id: ActiveTab;
  label: string;
  shortcut: string;
}

interface DesktopTabsProps {
  readonly tabs: readonly Tab[];
  readonly activeTab: ActiveTab;
  readonly activeIndex: number;
  readonly prefersReducedMotion: boolean;
  readonly onSelectTab: (tabId: ActiveTab) => void;
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

export function DesktopTabs({
  tabs,
  activeTab,
  activeIndex,
  prefersReducedMotion,
  onSelectTab,
  onKeyDown,
}: DesktopTabsProps) {
  return (
    <nav className="hidden md:flex" role="tablist" aria-label="Encryption modes">
      <div className="flex gap-1">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tab.id}-panel`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => {
                onSelectTab(tab.id);
              }}
              onKeyDown={onKeyDown}
              className={`
                relative px-4 py-2 text-sm font-medium rounded-md
                ${prefersReducedMotion ? "" : "transition-colors duration-200"}
                focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
                ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }
              `}
            >
              <span className="flex items-center gap-2 whitespace-nowrap">
                {tab.label}
                <kbd
                  className="hidden lg:inline-block px-1.5 py-0.5 text-xs font-mono bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-600"
                  aria-label={`Keyboard shortcut ${tab.shortcut}`}
                >
                  {tab.shortcut}
                </kbd>
              </span>
              {isActive && (
                <span
                  className={`absolute bottom-0 left-0 right-0 h-0.5 bg-primary ${prefersReducedMotion ? "" : "transition-all duration-300"}`}
                  style={{
                    transform: `translateX(${String((index - activeIndex) * 100)}%)`,
                  }}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
