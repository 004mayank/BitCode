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
 * Pixel-art "BitCode" logo — inlined SVG so there's zero caching/optimization
 * between the source and what the browser renders.
 *
 * Grid: px=5, 5-col × 7-row per character, y_start=8
 * "Bit" colour toggles white ↔ near-black with theme.
 * "Code" is always purple.
 */
function BitCodeLogo({ isDark }: { isDark: boolean }) {
  const bit = isDark ? "#ffffff" : "#111111";
  const code = isDark ? "#8A5CFF" : "#6C3BFF";
  const p = 5; // pixel size

  // Helper: render one pixel square
  const px = (x: number, y: number, fill: string) => (
    <rect key={`${x}-${y}`} x={x} y={y} width={p} height={p} fill={fill} />
  );

  // Character pixel maps — [col, row][] for each lit pixel
  const B: [number,number][] = [
    [0,0],[1,0],[2,0],[3,0],
    [0,1],[4,1],
    [0,2],[4,2],
    [0,3],[1,3],[2,3],[3,3],
    [0,4],[4,4],
    [0,5],[4,5],
    [0,6],[1,6],[2,6],[3,6],
  ];
  const I: [number,number][] = [
    [0,0],[1,0],[2,0],
    [1,1],[1,2],[1,3],[1,4],[1,5],
    [0,6],[1,6],[2,6],
  ];
  const T: [number,number][] = [
    [1,0],[1,1],
    [0,2],[1,2],[2,2],[3,2],
    [1,3],[1,4],[1,5],[1,6],
  ];
  const C: [number,number][] = [
    [1,0],[2,0],[3,0],[4,0],
    [0,1],[0,2],[0,3],[0,4],[0,5],
    [1,6],[2,6],[3,6],[4,6],
  ];
  const O: [number,number][] = [
    [1,0],[2,0],[3,0],
    [0,1],[4,1],[0,2],[4,2],[0,3],[4,3],[0,4],[4,4],[0,5],[4,5],
    [1,6],[2,6],[3,6],
  ];
  const D: [number,number][] = [
    [4,0],[4,1],
    [1,2],[2,2],[3,2],[4,2],
    [0,3],[4,3],[0,4],[4,4],[0,5],[4,5],
    [1,6],[2,6],[3,6],[4,6],
  ];
  const E: [number,number][] = [
    [1,0],[2,0],[3,0],
    [0,1],[4,1],[0,2],[4,2],
    [0,3],[1,3],[2,3],[3,3],[4,3],
    [0,4],[0,5],
    [1,6],[2,6],[3,6],[4,6],
  ];

  // x offsets for each character (px=5 per column, gaps between chars)
  const xB = 6;
  const xI = xB + 5*p + 4;   // 35
  const xT = xI + 3*p + 4;   // 54
  const xC = xT + 4*p + 10;  // 84
  const xO = xC + 5*p + 4;   // 113
  const xD = xO + 5*p + 4;   // 142
  const xE = xD + 5*p + 4;   // 171

  const yStart = 8;

  const renderChar = (pixels: [number,number][], xOff: number, fill: string) =>
    pixels.map(([col, row]) => px(xOff + col * p, yStart + row * p, fill));

  return (
    <svg
      viewBox="0 0 200 50"
      width="200"
      height="50"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      style={{ width: "100%", height: "auto", display: "block" }}
      aria-label="BitCode"
    >
      {renderChar(B, xB, bit)}
      {renderChar(I, xI, bit)}
      {renderChar(T, xT, bit)}
      {renderChar(C, xC, code)}
      {renderChar(O, xO, code)}
      {renderChar(D, xD, code)}
      {renderChar(E, xE, code)}
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
      {/* Logo */}
      <div style={{ padding: "14px 14px 10px" }}>
        <Link href="/" style={{ textDecoration: "none", display: "block" }}>
          <BitCodeLogo isDark={isDark} />
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
