import { useEffect } from "react";
import { useThemeEffect } from "@/store/ui-store";

export function ThemeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = useThemeEffect();

  // Apply theme on mount and when it changes
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return <>{children}</>;
}
