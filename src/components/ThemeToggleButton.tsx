"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type AppTheme = "light" | "dark";

function subscribeTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === "forno_theme") callback();
  };
  window.addEventListener("forno-theme-change", callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("forno-theme-change", callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getThemeSnapshot(): AppTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerThemeSnapshot(): AppTheme {
  return "light";
}

export function toggleAppTheme() {
  if (typeof document === "undefined") return;
  const next: AppTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("forno_theme", next);
  } catch {
    // Ignore storage restriction
  }
  window.dispatchEvent(new Event("forno-theme-change"));
}

export function useAppTheme() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  return { theme, toggleTheme: toggleAppTheme };
}

export function ThemeToggleButton({
  variant = "surface",
  showLabel = false,
  className = "",
}: {
  variant?: "surface" | "shell";
  showLabel?: boolean;
  className?: string;
}) {
  const { theme, toggleTheme } = useAppTheme();
  const isDark = theme === "dark";

  const baseClasses =
    variant === "shell"
      ? "inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-2.5 py-2 text-xs font-semibold text-[#FAF3E8] transition hover:bg-white/20"
      : showLabel
        ? "inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-warm)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:bg-[var(--bg-canvas)]"
        : "icon-btn";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${baseClasses} ${className}`}
      aria-label={
        isDark ? "Ativar tema claro" : "Ativar tema escuro"
      }
      title={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 shrink-0 text-amber-300" />
      ) : (
        <Moon className="h-4 w-4 shrink-0" />
      )}
      {showLabel && (
        <span className="hidden sm:inline">
          {isDark ? "Claro" : "Escuro"}
        </span>
      )}
    </button>
  );
}
