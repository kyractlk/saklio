import React, { createContext, useContext, useMemo } from "react";

export type ThemeMode = "soft" | "dark" | "color" | "sunset" | "ocean";

export interface ThemeColors {
  surface: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  elevated: string;
  onSurface: string;
  mutedText: string;
  brand: string;
  brandDark: string;
  accent: string;
  onBrand: string;
  success: string;
  warning: string;
  error: string;
  border: string;
  glassBg: string;
  tabInactive: string;
}

const SOFT: ThemeColors = {
  surface: "#F8F7F2",
  surfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#DDF3E6",
  elevated: "#FFFFFF",
  onSurface: "#202522",
  mutedText: "#757D78",
  brand: "#8FCFAE",
  brandDark: "#5B9F7D",
  accent: "#DDF3E6",
  onBrand: "#0E241A",
  success: "#68B58A",
  warning: "#E9B75C",
  error: "#DF7C76",
  border: "#EAE8DF",
  glassBg: "rgba(255,255,255,0.72)",
  tabInactive: "#A9AFA9",
};

const DARK: ThemeColors = {
  surface: "#111512",
  surfaceSecondary: "#181D1A",
  surfaceTertiary: "#202722",
  elevated: "#202722",
  onSurface: "#F6F7F6",
  mutedText: "#9DA7A0",
  brand: "#8FD3AF",
  brandDark: "#5B9F7D",
  accent: "#202722",
  onBrand: "#0E241A",
  success: "#68B58A",
  warning: "#E9B75C",
  error: "#DF7C76",
  border: "#2A322C",
  glassBg: "rgba(24,29,26,0.72)",
  tabInactive: "#5C665E",
};

const COLOR: ThemeColors = {
  surface: "#FBF9FF",
  surfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#EDE7FB",
  elevated: "#FFFFFF",
  onSurface: "#26233A",
  mutedText: "#7B7790",
  brand: "#A9C7F5",
  brandDark: "#6C93D6",
  accent: "#EDE7FB",
  onBrand: "#1D2A44",
  success: "#7FC8A9",
  warning: "#F0B96A",
  error: "#E58C86",
  border: "#ECE7F5",
  glassBg: "rgba(255,255,255,0.72)",
  tabInactive: "#B4AEC6",
};

const SUNSET: ThemeColors = {
  surface: "#FFF6F0",
  surfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#FCE3D4",
  elevated: "#FFFFFF",
  onSurface: "#3A2A22",
  mutedText: "#9A8377",
  brand: "#F0A87E",
  brandDark: "#D97D4E",
  accent: "#FCE3D4",
  onBrand: "#43220E",
  success: "#68B58A",
  warning: "#E9B75C",
  error: "#DF7C76",
  border: "#F4E2D6",
  glassBg: "rgba(255,255,255,0.72)",
  tabInactive: "#C9AF9F",
};

const OCEAN: ThemeColors = {
  surface: "#F1F7FB",
  surfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#DCEBF6",
  elevated: "#FFFFFF",
  onSurface: "#16303F",
  mutedText: "#6C8391",
  brand: "#6FB7D6",
  brandDark: "#3E86A8",
  accent: "#DCEBF6",
  onBrand: "#08222E",
  success: "#5FB6A4",
  warning: "#E9B75C",
  error: "#E58C86",
  border: "#DCE7EE",
  glassBg: "rgba(255,255,255,0.72)",
  tabInactive: "#A9BEC9",
};

export const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  elektronik: { bg: "#BBD4EE", fg: "#25415F" },
  moda: { bg: "#D1C4E9", fg: "#432D63" },
  ev: { bg: "#FFCC80", fg: "#6B4406" },
  otomotiv: { bg: "#B0BEC5", fg: "#2E3A40" },
  diger: { bg: "#DDF3E6", fg: "#2C5C43" },
};

export const CATEGORY_LABELS: Record<string, string> = {
  tumu: "Tümü",
  elektronik: "Elektronik",
  moda: "Moda",
  ev: "Ev",
  otomotiv: "Otomotiv",
  diger: "Diğer",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 40 };
export const radius = { sm: 8, md: 16, lg: 24, pill: 9999 };

export const font = {
  size: { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 26, "3xl": 34 },
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
};

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  spacing: typeof spacing;
  radius: typeof radius;
  font: typeof font;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MAP: Record<ThemeMode, ThemeColors> = { soft: SOFT, dark: DARK, color: COLOR, sunset: SUNSET, ocean: OCEAN };

export function ThemeProvider({ mode, children }: { mode: ThemeMode; children: React.ReactNode }) {
  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: MAP[mode] || SOFT,
      isDark: mode === "dark",
      spacing,
      radius,
      font,
    }),
    [mode]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
