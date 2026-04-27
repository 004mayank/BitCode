"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

const ICONS: Record<Theme, string> = { dark: "🌙", light: "☀️", system: "⬤" };
const LABELS: Record<Theme, string> = { dark: "Dark", light: "Light", system: "System" };
const ORDER: Theme[] = ["dark", "light", "system"];

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem("bc-theme") as Theme) || "dark";
    setTheme(saved);
    setMounted(true);
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    localStorage.setItem("bc-theme", next);
    document.documentElement.dataset.theme = next;
  }

  if (!mounted) return null;

  return (
    <button
      onClick={cycle}
      title={`Theme: ${LABELS[theme]} — click to switch`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--card)",
        color: "var(--text-2)",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 13 }}>{ICONS[theme]}</span>
      {LABELS[theme]}
    </button>
  );
}
