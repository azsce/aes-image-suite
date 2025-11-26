import { Button } from "@/components/ui/button";
import { Keyboard } from "lucide-react";

interface KeyboardShortcutsMenuProps {
  readonly showShortcuts: boolean;
  readonly onToggle: () => void;
  readonly onBlur: () => void;
}

export function KeyboardShortcutsMenu({ showShortcuts, onToggle, onBlur }: KeyboardShortcutsMenuProps) {
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        onClick={onToggle}
        onBlur={onBlur}
        aria-label="Show keyboard shortcuts"
        title="Keyboard shortcuts"
        className="hidden sm:flex"
      >
        <Keyboard className="h-[1.2rem] w-[1.2rem]" aria-hidden="true" />
        <span className="sr-only">Keyboard shortcuts</span>
      </Button>
      {showShortcuts && (
        <div
          className="absolute right-0 top-full mt-2 w-64 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50"
          role="tooltip"
        >
          <h3 className="text-sm font-semibold mb-2 text-slate-900 dark:text-gray-100">Keyboard Shortcuts</h3>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-gray-300">
            <li className="flex justify-between">
              <span>Encryption mode</span>
              <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-600 font-mono text-xs">
                1
              </kbd>
            </li>
            <li className="flex justify-between">
              <span>Decryption mode</span>
              <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-600 font-mono text-xs">
                2
              </kbd>
            </li>
            <li className="flex justify-between">
              <span>Comparison mode</span>
              <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-600 font-mono text-xs">
                3
              </kbd>
            </li>
            <li className="flex justify-between">
              <span>Download output</span>
              <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-600 font-mono text-xs">
                Ctrl+D
              </kbd>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
