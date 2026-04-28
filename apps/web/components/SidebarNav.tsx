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
 * Pixel-art laptop with </ > on screen — shown when sidebar is collapsed.
 * 14-col × 12-row grid, p=2. Matches the brand laptop icon.
 */
function CollapsedMark() {
  const frame  = "#4a4b6a";   // screen housing
  const screen = "#0c1240";   // dark navy screen bg
  const green  = "#2bff2b";   // </ > colour
  const base   = "#3b3c5a";   // keyboard base

  return (
    <svg
      viewBox="0 0 28 26"
      width="28"
      height="26"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      aria-label="[/]"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* ── Screen housing (outer frame) ── */}
      <rect x="0"  y="0"  width="28" height="20" fill={frame}/>
      {/* ── Screen interior ── */}
      <rect x="2"  y="2"  width="24" height="16" fill={screen}/>

      {/* ── < ── */}
      <rect x="8"  y="4"  width="2" height="2" fill={green}/>
      <rect x="6"  y="6"  width="2" height="2" fill={green}/>
      <rect x="4"  y="8"  width="2" height="2" fill={green}/>
      <rect x="6"  y="10" width="2" height="2" fill={green}/>
      <rect x="8"  y="12" width="2" height="2" fill={green}/>

      {/* ── / ── */}
      <rect x="14" y="4"  width="2" height="2" fill={green}/>
      <rect x="12" y="6"  width="2" height="2" fill={green}/>
      <rect x="12" y="8"  width="2" height="2" fill={green}/>
      <rect x="10" y="10" width="2" height="2" fill={green}/>
      <rect x="10" y="12" width="2" height="2" fill={green}/>

      {/* ── > ── */}
      <rect x="16" y="4"  width="2" height="2" fill={green}/>
      <rect x="18" y="6"  width="2" height="2" fill={green}/>
      <rect x="20" y="8"  width="2" height="2" fill={green}/>
      <rect x="18" y="10" width="2" height="2" fill={green}/>
      <rect x="16" y="12" width="2" height="2" fill={green}/>

      {/* ── cursor ── */}
      <rect x="4"  y="14" width="4"  height="2" fill={green}/>

      {/* ── keyboard base ── */}
      <rect x="2"  y="20" width="24" height="2" fill={base}/>
      <rect x="6"  y="22" width="16" height="2" fill={base}/>
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
          <CollapsedMark />
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
