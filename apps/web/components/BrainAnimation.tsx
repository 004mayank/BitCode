"use client";
import { useEffect, useRef } from "react";

const CHARS = "$$SBZhnjkwm01ABCDEFabcdef@#&*{}[]<>|+-$$";

// Display size is half the canvas pixel size (2× retina-style render)
const DISPLAY_SCALE = 0.5;

// Number of visible ridges across the fingerprint
const N_RINGS = 18;
// Fraction of each ridge cycle that is "lit" (vs gap)
const RIDGE_FRACTION = 0.52;

export function BrainAnimation({ size = 580 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dispW = Math.round(size * 0.82);
    const dispH = size;
    const W = dispW / DISPLAY_SCALE;
    const H = dispH / DISPLAY_SCALE;
    canvas.width  = W;
    canvas.height = H;

    const CW = 10;
    const CH = 15;
    const COLS = Math.floor(W / CW);
    const ROWS = Math.floor(H / CH);

    const cx = W / 2;
    const cy = H * 0.50;
    // Semi-axes of the clipping ellipse
    const MAX_RX = W * 0.455;
    const MAX_RY = H * 0.468;

    // ─────────────────────────────────────────────────────────────────────
    // fingerprintRidge — uses the classic potential-flow "doublet" stream
    // function to generate authentic fingerprint loop topology.
    //
    //   ψ(x, y) = ny * (1 + a / r²)
    //
    //   where  nx, ny  are ellipse-normalised coordinates
    //          r²      = nx² + ny²
    //          a       = doublet strength  (controls loop size)
    //
    // Level-set geometry:
    //   |ψ| < 2√a  →  closed loops (fingerprint core / delta)
    //   |ψ| ≥ 2√a  →  open arches (outer ridges flowing around the core)
    //
    // We map ψ → ring index in [0, N_RINGS] so that the ridge/gap
    // pattern repeats smoothly across the whole fingerprint.
    // ─────────────────────────────────────────────────────────────────────
    function fingerprintRing(px: number, py: number): number {
      const dx = px - cx;
      const dy = py - cy;

      // Clip to ellipse
      if ((dx / MAX_RX) ** 2 + (dy / MAX_RY) ** 2 > 1) return -1;

      // Normalise so the doublet lives in a unit circle
      const nx = dx / MAX_RX;
      const ny = dy / MAX_RY;
      const r2 = nx * nx + ny * ny;

      // Doublet strength — tuned so the loop core spans ~25 % of radius
      const a = 0.09;

      // Stream function value
      const psi = ny * (1.0 + a / Math.max(r2, 0.003));

      // ψ ranges roughly from -(1 + a/~0) to +(1 + a/~0).
      // We clamp to [-MAX_PSI, MAX_PSI] then map to [0, N_RINGS].
      const MAX_PSI = 1.22;
      const clamped = Math.max(-MAX_PSI, Math.min(MAX_PSI, psi));
      // Map [-MAX_PSI, MAX_PSI] → [0, N_RINGS]
      return ((clamped + MAX_PSI) / (2 * MAX_PSI)) * N_RINGS;
    }

    function isOnRidge(col: number, row: number): boolean {
      const ring = fingerprintRing((col + 0.5) * CW, (row + 0.5) * CH);
      if (ring < 0) return false;
      // fractional part determines ridge vs gap
      return (ring % 1) < RIDGE_FRACTION;
    }

    /* ── Character grid ── */
    const grid = Array.from({ length: COLS * ROWS }, () => ({
      char:  CHARS[Math.floor(Math.random() * CHARS.length)],
      alpha: 0.78 + Math.random() * 0.22,
      rate:  0.004 + Math.random() * 0.022,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0, raf = 0;
    const HOVER_R = 120;  // canvas pixels (= 60 display px)

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - r.left) * (W / r.width),
        y: (e.clientY - r.top)  * (H / r.height),
      };
    };
    const onLeave = () => { mouseRef.current = null; };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      ctx!.font = `bold 14px "Courier New", Courier, monospace`;
      t += 0.013;

      const mouse = mouseRef.current;

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (!isOnRidge(col, row)) continue;

          const cell = grid[row * COLS + col];
          if (Math.random() < cell.rate) {
            cell.char = CHARS[Math.floor(Math.random() * CHARS.length)];
            if (Math.random() < 0.04) cell.alpha = 0.78 + Math.random() * 0.22;
          }

          const pulse = 0.93 + 0.07 * Math.sin(t * 1.1 + cell.phase);
          let a = Math.min(1, cell.alpha * pulse);

          if (mouse) {
            const px = (col + 0.5) * CW;
            const py = (row + 0.5) * CH;
            const dist = Math.sqrt((px - mouse.x) ** 2 + (py - mouse.y) ** 2);
            if (dist < HOVER_R) {
              const norm = dist / HOVER_R;
              a *= norm * norm;
            }
          }

          if (a < 0.02) continue;
          ctx!.fillStyle = `rgba(0,210,175,${a})`;
          ctx!.fillText(cell.char, col * CW, (row + 1) * CH - 2);
        }
      }

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.round(size * 0.82) / DISPLAY_SCALE}
      height={size / DISPLAY_SCALE}
      style={{
        display: "block",
        cursor: "crosshair",
        width:  Math.round(size * 0.82),
        height: size,
        filter:
          "drop-shadow(0 0 32px rgba(0,210,175,0.60)) drop-shadow(0 0 80px rgba(0,210,175,0.22))",
      }}
    />
  );
}
