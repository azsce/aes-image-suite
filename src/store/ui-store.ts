import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type Theme = "dark" | "light" | "system";

interface UIState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    set => ({
      theme: "dark",
      setTheme: theme => set({ theme }),
    }),
    {
      name: "aes-ui-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Hook to apply theme to DOM
export const useThemeEffect = () => {
  const theme = useUIStore(state => state.theme);

  // Apply theme class to document root
  if (typeof window !== "undefined") {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }

  return theme;
};
