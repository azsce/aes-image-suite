import { useUIStore } from "@/store/ui-store";

export const useTheme = () => {
  const theme = useUIStore(state => state.theme);
  const setTheme = useUIStore(state => state.setTheme);

  return { theme, setTheme };
};
