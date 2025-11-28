"use client";

import { createContext, useContext, ReactNode } from "react";
import type { AppTheme, ThemeConfig } from "../types";
import { THEMES } from "../types";

// ============================================================================
// THEME CONTEXT
// ============================================================================

interface ThemeContextValue {
  theme: AppTheme;
  config: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "emerald",
  config: THEMES.emerald,
});

// ============================================================================
// THEME PROVIDER
// ============================================================================

interface ThemeProviderProps {
  theme: AppTheme;
  children: ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const config = THEMES[theme];

  return (
    <ThemeContext.Provider value={{ theme, config }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// USE THEME HOOK
// ============================================================================

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// ============================================================================
// THEME UTILITIES
// ============================================================================

/**
 * Get primary button classes based on theme
 */
export function getPrimaryButtonClasses(theme: AppTheme): string {
  const themeColors: Record<AppTheme, string> = {
    emerald: "bg-emerald-500 hover:bg-emerald-400",
    purple: "bg-purple-500 hover:bg-purple-400",
    blue: "bg-blue-500 hover:bg-blue-400",
    orange: "bg-orange-500 hover:bg-orange-400",
    rose: "bg-rose-500 hover:bg-rose-400",
  };
  return themeColors[theme];
}

/**
 * Get focus ring classes based on theme
 */
export function getFocusRingClasses(theme: AppTheme): string {
  const themeColors: Record<AppTheme, string> = {
    emerald: "focus:ring-emerald-500",
    purple: "focus:ring-purple-500",
    blue: "focus:ring-blue-500",
    orange: "focus:ring-orange-500",
    rose: "focus:ring-rose-500",
  };
  return themeColors[theme];
}

/**
 * Get accent background classes based on theme
 */
export function getAccentBgClasses(theme: AppTheme): string {
  const themeColors: Record<AppTheme, string> = {
    emerald: "bg-emerald-500/10",
    purple: "bg-purple-500/10",
    blue: "bg-blue-500/10",
    orange: "bg-orange-500/10",
    rose: "bg-rose-500/10",
  };
  return themeColors[theme];
}

/**
 * Get accent text classes based on theme
 */
export function getAccentTextClasses(theme: AppTheme): string {
  const themeColors: Record<AppTheme, string> = {
    emerald: "text-emerald-400",
    purple: "text-purple-400",
    blue: "text-blue-400",
    orange: "text-orange-400",
    rose: "text-rose-400",
  };
  return themeColors[theme];
}
