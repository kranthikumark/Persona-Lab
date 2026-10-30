"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const storageKey = "persona-lab-theme";
function subscribe(notify: () => void) {
  function sync(event: StorageEvent) {
    if (event.key !== storageKey && event.key !== null) return;
    document.documentElement.dataset.theme =
      event.newValue === "light" ? "light" : "dark";
    notify();
  }
  window.addEventListener("storage", sync);
  window.addEventListener("persona-theme-change", notify);
  return () => {
    window.removeEventListener("storage", sync);
    window.removeEventListener("persona-theme-change", notify);
  };
}
function snapshot() {
  return document.documentElement.dataset.theme === "light";
}

export function ThemeToggle() {
  const light = useSyncExternalStore(subscribe, snapshot, () => false);
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Light theme · currently ${light ? "Light" : "Dark"}`}
      aria-pressed={light}
      title={light ? "Switch to dark theme" : "Switch to light theme"}
      onClick={() => {
        const theme = light ? "dark" : "light";
        document.documentElement.dataset.theme = theme;
        try {
          localStorage.setItem(storageKey, theme);
        } catch {
          // Theme switching still works when browser storage is unavailable.
        }
        window.dispatchEvent(new Event("persona-theme-change"));
      }}
    >
      {light ? (
        <Sun size={16} aria-hidden="true" />
      ) : (
        <Moon size={16} aria-hidden="true" />
      )}
      <span>{light ? "Light" : "Dark"}</span>
    </button>
  );
}
