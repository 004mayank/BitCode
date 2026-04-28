"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
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

/**
 * Full pixel-art "BitCode" logo — shown when sidebar is expanded.
 */
function BitCodeLogo({ isDark }: { isDark: boolean }) {
  const bit = isDark ? "#ffffff" : "#111111";
  const code = isDark ? "#8A5CFF" : "#6C3BFF";
  const p = 5;
  const px = (x: number, y: number, fill: string) => (
    <rect key={`${x}-${y}`} x={x} y={y} width={p} height={p} fill={fill} />
  );
  const B: [number,number][] = [[0,0],[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3],[0,4],[4,4],[0,5],[4,5],[0,6],[1,6],[2,6],[3,6]];
  const I: [number,number][] = [[0,0],[1,0],[2,0],[1,1],[1,2],[1,3],[1,4],[1,5],[0,6],[1,6],[2,6]];
  const T: [number,number][] = [[1,0],[1,1],[0,2],[1,2],[2,2],[3,2],[1,3],[1,4],[1,5],[1,6]];
  const C: [number,number][] = [[1,0],[2,0],[3,0],[4,0],[0,1],[0,2],[0,3],[0,4],[0,5],[1,6],[2,6],[3,6],[4,6]];
  const O: [number,number][] = [[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[4,2],[0,3],[4,3],[0,4],[4,4],[0,5],[4,5],[1,6],[2,6],[3,6]];
  const D: [number,number][] = [[4,0],[4,1],[1,2],[2,2],[3,2],[4,2],[0,3],[4,3],[0,4],[4,4],[0,5],[4,5],[1,6],[2,6],[3,6],[4,6]];
  const E: [number,number][] = [[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3],[4,3],[0,4],[0,5],[1,6],[2,6],[3,6],[4,6]];

  const xB = 6; const xI = xB+5*p+4; const xT = xI+3*p+4;
  const xC = xT+4*p+10; const xO = xC+5*p+4; const xD = xO+5*p+4; const xE = xD+5*p+4;
  const yStart = 8;
  const renderChar = (pixels: [number,number][], xOff: number, fill: string) =>
    pixels.map(([col, row]) => px(xOff + col * p, yStart + row * p, fill));

  return (
    <svg
      viewBox="0 0 200 50"
      width="160"
      height="40"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      style={{ display: "block", flexShrink: 0 }}
      aria-label="BitCode"
    >
      {renderChar(B, xB, bit)}{renderChar(I, xI, bit)}{renderChar(T, xT, bit)}
      {renderChar(C, xC, code)}{renderChar(O, xO, code)}{renderChar(D, xD, code)}{renderChar(E, xE, code)}
    </svg>
  );
}

/**
 * Compact monogram shown when sidebar is collapsed.
 * Pixel-art "B{" — 28×28 grid, p=4
 */
function CollapsedMark({ isDark }: { isDark: boolean }) {
  const fg  = isDark ? "#ffffff" : "#111111";
  const acc = isDark ? "#8A5CFF" : "#6C3BFF";
  const p = 3;
  // ">" chevron in accent
  const chevron: [number,number][] = [[0,0],[1,1],[2,2],[1,3],[0,4]];
  // "/" slash in fg
  const slash: [number,number][] = [[3,0],[2,1],[1,2],[0,3]];

  const px = (x: number, y: number, fill: string) => (
    <rect key={`${x}-${y}`} x={8 + x*p} y={6 + y*p} width={p} height={p} fill={fill} />
  );

  return (
    <svg
      viewBox="0 0 28 28"
      width="28"
      height="28"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      aria-label="BC"
      style={{ display: "block", flexShrink: 0 }}
    >
      {chevron.map(([c, r]) => px(c, r, acc))}
      {slash.map(([c, r]) => px(c, r, fg))}
    </svg>
  );
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

      {/* ── Logo row — 48 px, aligns with topbar ── */}
      <Link href="/" className="sidebar-logo-row" aria-label="Home">
        {/* Collapsed mark */}
        <span className="sidebar-mark">
          <CollapsedMark isDark={isDark} />
        </span>
        {/* Full logo (fades in when expanded) */}
        <span className="sidebar-wordmark">
          <BitCodeLogo isDark={isDark} />
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
