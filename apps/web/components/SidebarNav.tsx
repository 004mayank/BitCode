"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Dashboard", icon: "⊞" },
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
      // system
      setIsDark(!window.matchMedia("(prefers-color-scheme: light)").matches);
    }

    compute();

    // Watch for data-theme attribute changes (ThemeToggle writes this)
    const observer = new MutationObserver(compute);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    // Watch for OS preference changes (system mode)
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", compute);

    return () => { observer.disconnect(); mq.removeEventListener("change", compute); };
  }, []);

  return isDark;
}

export function SidebarNav() {
  const path = usePathname();
  const isDark = useEffectiveTheme();

  function isActive(href: string) {
    if (href === "/") return path === "/";
    return path.startsWith(href);
  }

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div style={{ padding: "14px 14px 10px" }}>
        <Link href="/" style={{ textDecoration: "none", display: "block" }}>
          <Image
            src={isDark ? "/bitcode-dark.svg" : "/bitcode-light.svg"}
            alt="BitCode"
            width={180}
            height={60}
            style={{ width: "100%", height: "auto", display: "block" }}
            priority
          />
        </Link>
      </div>

      <hr className="divider" style={{ margin: "0 0 8px" }} />

      {/* Nav links */}
      <div style={{ flex: 1 }}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link${isActive(item.href) ? " active" : ""}`}
          >
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
          Use AI effectively.<br />
          Get scored on how.
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
          <Link href="/auth" className="btn secondary sm" style={{ flex: 1, justifyContent: "center" }}>
            Sign in
          </Link>
        </div>
      </div>
    </nav>
  );
}
