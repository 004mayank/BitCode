"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PixelLaptopIcon, BitCodeNavLogo } from "./BitCodeLogo";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/challenges", label: "Challenges", icon: "⚡" },
  { href: "/bounties", label: "Bounties", icon: "◎" },
  { href: "/leaderboard", label: "Leaderboard", icon: "▲" },
  { href: "/profile", label: "Profile", icon: "◉" },
];

function useEffectiveTheme() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    function compute() {
      const t = document.documentElement.dataset.theme || "dark";
      if (t === "light") return setIsDark(false);
      if (t === "dark")  return setIsDark(true);
      setIsDark(!window.matchMedia("(prefers-color-scheme: light)").matches);
    }
    compute();
    const observer = new MutationObserver(compute);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", compute);
    return () => { observer.disconnect(); mq.removeEventListener("change", compute); };
  }, []);

  return isDark;
}

// BitCodeLogo and CollapsedMark are now provided by the shared BitCodeLogo component.

export function SidebarNav() {
  const path = usePathname();
  const isDark = useEffectiveTheme();

  function isActive(href: string) {
    if (href === "/dashboard") return path === "/dashboard";
    return path.startsWith(href);
  }

  return (
    <nav className="sidebar">

      {/* ── Logo row — 48 px, aligns with topbar ── */}
      <Link href="/" className="sidebar-logo-row" aria-label="Home">
        {/* Collapsed mark — pixel laptop icon only */}
        <span className="sidebar-mark">
          <PixelLaptopIcon cellSize={2} />
        </span>
        {/* Full logo — icon + "BitCode" wordmark (fades in when expanded) */}
        <span className="sidebar-wordmark">
          <BitCodeNavLogo cellSize={2} textSize={18} gap={10} />
        </span>
      </Link>

      {/* ── Nav links ── */}
      <div style={{ flex: 1, paddingTop: 6 }}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`nav-link${isActive(item.href) ? " active" : ""}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        {/* Icon-only button shown when collapsed */}
        <Link href="/auth" title="Sign in" className="sidebar-footer-icon btn secondary sm">
          ◉
        </Link>
        {/* Full footer shown when expanded */}
        <div className="sidebar-footer-full">
          <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
            Use AI effectively.<br />Get scored on how.
          </div>
          <div style={{ marginTop: 8 }}>
            <Link href="/auth" className="btn secondary sm" style={{ width: "100%", justifyContent: "center" }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>

    </nav>
  );
}
