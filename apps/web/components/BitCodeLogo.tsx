/**
 * BitCodeLogo — shared pixel-art brand components.
 *
 * Exports:
 *   PixelLaptopIcon   — just the laptop icon (for small contexts, collapsed sidebar)
 *   BitCodeNavLogo    — icon + "BitCode" text side-by-side (for navbars)
 */

import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// PixelLaptopIcon
// ─────────────────────────────────────────────────────────────────────────────
// 32-col × 28-row grid, each cell = p px.
// Matches the reference: chunky pixel-art laptop, dark screen, green </>
// with cursor, visible keyboard section below.
// ─────────────────────────────────────────────────────────────────────────────

type R = { x: number; y: number; w?: number; h?: number; fill: string };

function rects(p: number, items: R[]) {
  return items.map(({ x, y, w = 1, h = 1, fill }, i) => (
    <rect key={i} x={x * p} y={y * p} width={w * p} height={h * p} fill={fill} />
  ));
}

export function PixelLaptopIcon({ cellSize = 2 }: { cellSize?: number }) {
  const p = cellSize;

  // Palette
  const F  = "#5a5b7e"; // frame highlight (lighter outer border)
  const B  = "#3c3d5c"; // body / bezel
  const S  = "#0c0d26"; // screen BG (very dark navy)
  const G  = "#7abf3c"; // green — </>  and cursor
  const K  = "#2e2f4a"; // keyboard surface
  const KH = "#3a3b58"; // key highlight row
  const KK = "#252640"; // individual key shadows
  const T  = "#1e1f38"; // trackpad

  // viewBox = 32 cols × 28 rows  (= 64×56 at p=2)
  const W = 32, H = 28;

  return (
    <svg
      viewBox={`0 0 ${W * p} ${H * p}`}
      width={W * p}
      height={H * p}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* ── Screen outer frame ── */}
      {rects(p, [
        // top bar
        { x: 2, y: 0, w: 28, h: 1, fill: F },
        // left/right vertical bars
        { x: 1, y: 1, w: 1, h: 15, fill: F },
        { x: 30, y: 1, w: 1, h: 15, fill: F },
        // bottom bar of screen
        { x: 2, y: 16, w: 28, h: 1, fill: F },
        // inner body (bezel)
        { x: 2, y: 1, w: 28, h: 15, fill: B },
      ])}

      {/* ── Screen interior ── */}
      {rects(p, [
        { x: 3, y: 2, w: 26, h: 13, fill: S },
      ])}

      {/* ── < character (col 5–7, rows 4–12) ── */}
      {rects(p, [
        { x: 8,  y: 4,  fill: G },
        { x: 7,  y: 5,  fill: G },
        { x: 6,  y: 6,  fill: G },
        { x: 5,  y: 7,  fill: G },
        { x: 6,  y: 8,  fill: G },
        { x: 7,  y: 9,  fill: G },
        { x: 8,  y: 10, fill: G },
      ])}

      {/* ── / character (col 13–15, rows 4–12) ── */}
      {rects(p, [
        { x: 16, y: 4,  fill: G },
        { x: 15, y: 5,  fill: G },
        { x: 14, y: 6,  fill: G },
        { x: 14, y: 7,  fill: G },
        { x: 13, y: 8,  fill: G },
        { x: 13, y: 9,  fill: G },
        { x: 12, y: 10, fill: G },
      ])}

      {/* ── > character (col 19–21, rows 4–12) ── */}
      {rects(p, [
        { x: 20, y: 4,  fill: G },
        { x: 21, y: 5,  fill: G },
        { x: 22, y: 6,  fill: G },
        { x: 23, y: 7,  fill: G },
        { x: 22, y: 8,  fill: G },
        { x: 21, y: 9,  fill: G },
        { x: 20, y: 10, fill: G },
      ])}

      {/* ── cursor _ (row 13) ── */}
      {rects(p, [
        { x: 5, y: 13, w: 5, h: 1, fill: G },
      ])}

      {/* ── Hinge (narrow strip between screen and keyboard) ── */}
      {rects(p, [
        { x: 8, y: 17, w: 16, h: 2, fill: B },
      ])}

      {/* ── Keyboard base (wider than screen) ── */}
      {rects(p, [
        // top surface
        { x: 0, y: 19, w: 32, h: 1, fill: F },
        // keyboard body
        { x: 0, y: 20, w: 32, h: 6, fill: K },
        // key row top highlight
        { x: 1, y: 21, w: 30, h: 1, fill: KH },
        // individual keys (6 key groups)
        { x: 2,  y: 22, w: 3, h: 2, fill: KK },
        { x: 7,  y: 22, w: 3, h: 2, fill: KK },
        { x: 12, y: 22, w: 3, h: 2, fill: KK },
        { x: 17, y: 22, w: 3, h: 2, fill: KK },
        { x: 22, y: 22, w: 3, h: 2, fill: KK },
        { x: 27, y: 22, w: 3, h: 2, fill: KK },
        // trackpad
        { x: 10, y: 25, w: 12, h: 1, fill: T },
        // bottom edge
        { x: 0, y: 26, w: 32, h: 1, fill: F },
        { x: 1, y: 27, w: 30, h: 1, fill: B },
      ])}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BitCodeNavLogo  — icon + wordmark  (for navbars and full logo spots)
// ─────────────────────────────────────────────────────────────────────────────

export function BitCodeNavLogo({
  cellSize = 2,
  textSize = 20,
  gap = 12,
  bitColor = "#fff",
}: {
  cellSize?: number;
  textSize?: number;
  gap?: number;
  /** Color for "Bit" — pass a dark color in light-mode contexts */
  bitColor?: string;
}) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap }}>
      <PixelLaptopIcon cellSize={cellSize} />
      <span style={{ fontSize: textSize, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>
        <span style={{ color: bitColor }}>Bit</span>
        <span style={{ color: "#8b5cf6" }}>Code</span>
      </span>
    </span>
  );
}
