/**
 * MainLayout component
 * Provides the main application structure with header and tab navigation
 */

import { ReactNode } from "react";
import { AppHeader } from "./AppHeader";

interface MainLayoutProps {
  readonly children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <AppHeader />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="container mx-auto px-4 py-0">{children}</div>
      </main>
    </div>
  );
}
