"use client";
import { useEffect, useRef } from "react";

const CHARS = "$$SBZhnjkwm01ABCDEFabcdef@#&*{}[]<>|+-$$";

// Display size is half the canvas pixel size (2× retina-style render)
// so ring lines are crisp and each ridge is ~2 visible characters wide.
const DISPLAY_SCALE = 0.5;

export function BrainAnimation({ size = 580 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Render 2× larger than displayed — gives crisp, dense rings
    const dispW = Math.round(size * 0.82);
    const dispH = size;
    const W = dispW  / DISPLAY_SCALE;   // actual canvas pixel width
    const H = dispH  / DISPLAY_SCALE;   // actual canvas pixel height
    canvas.width  = W;
    canvas.height = H;

    // Character cell at 2× — displays as ~5×7 px on screen
    const CW = 10;
    const CH = 15;
    const COLS = Math.floor(W / CW);
    const ROWS = Math.floor(H / CH);

    const cx    = W / 2;
    const cy    = H * 0.50;
    const MAX_RX = W * 0.455;
    const MAX_RY = H * 0.468;

    // Ring geometry — 16 rings, each ridge ~2 char cells wide
    const RING_PITCH = Math.round(MAX_RX / 15);   // ≈ px per cycle
    const RIDGE_W    = Math.round(RING_PITCH * 0.64);  // 64 % ridge, 36 % gap

    // ──────────────────────────────────────────────────────────────
    // fingerprintDist — ellipse-normalised radial distance with two
    // organic perturbations:
    //   1. angular warp  → outer ridges look natural / irregular
    //   2. loop topology → inner ridges form a teardrop / loop core
    //      (inner rings are offset upward relative to outer rings)
    // ──────────────────────────────────────────────────────────────
    function fingerprintDist(px: number, py: number): number {
      const dx = px - cx;
      const dy = py - cy;

      if ((dx / MAX_RX) ** 2 + (dy / MAX_RY) ** 2 > 1) return -1;

      const eDist = Math.sqrt(dx * dx + (dy * MAX_RX / MAX_RY) ** 2);
      const normR  = eDist / MAX_RX;           // 0 = centre, 1 = edge
      const theta  = Math.atan2(dy, dx);

      // Organic ridge-flow warp
      const flowWarp =
        Math.sin(theta * 2) * 2.8 +
        Math.cos(theta * 3) * 1.6;

      // Loop-core: inner rings are pulled upward (toward theta = -π/2)
      // sin(theta) is +1 at bottom, –1 at top; we SUBTRACT at top so inner
      // rings reach higher, forming the classic teardrop loop.
      const loopStrength = RING_PITCH * 0.65;
      const loopWarp = -Math.sin(theta) * Math.exp(-normR * 1.6) * loopStrength;

      return eDist + flowWarp + loopWarp;
    }

    function isOnRidge(col: number, row: number): boolean {
      const d = fingerprintDist((col + 0.5) * CW, (row + 0.5) * CH);
      if (d < 0) return false;
      return d % RING_PITCH < RIDGE_W;
    }

    /* ── Character grid — very high base alpha → solid, bright ridges ── */
    const grid = Array.from({ length: COLS * ROWS }, () => ({
      char:  CHARS[Math.floor(Math.random() * CHARS.length)],
      alpha: 0.78 + Math.random() * 0.22,
      rate:  0.004 + Math.random() * 0.022,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0, raf = 0;
    const HOVER_R = 120;  // in canvas pixels (= 60 display px)

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      // Scale from display CSS coords → canvas pixel coords
      mouseRef.current = {
        x: (e.clientX - r.left)  * (W / r.width),
        y: (e.clientY - r.top)   * (H / r.height),
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

          // Minimal pulse variance — ridges stay uniformly bright
          const pulse = 0.93 + 0.07 * Math.sin(t * 1.1 + cell.phase);
          let a = Math.min(1, cell.alpha * pulse);

          // Cursor patch: smooth quadratic fade
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

  // Canvas pixel size is 2× the display size
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
