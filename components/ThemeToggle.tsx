"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/format";
import { MoonIcon, SunIcon } from "@/components/ui/icons";

export const THEME_STORAGE_KEY = "replypilot:theme";

/**
 * Light/dark toggle. The actual `dark` class is applied to <html> before paint
 * by the inline script in app/layout.tsx (respecting localStorage, then the OS
 * `prefers-color-scheme`). This button just flips + persists the choice.
 *
 * Renders a stable placeholder until mounted so server and client markup match.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      /* ignore storage errors (private mode, etc.) */
    }
    setIsDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800",
        className
      )}
    >
      {/* Until mounted, render the moon so SSR/CSR markup is identical. */}
      {mounted && isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  );
}
