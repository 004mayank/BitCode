"use client";
import { useEffect, useRef } from "react";

const CHARS = "$$$$SBZhnjkwm01ABCDEFabcdef@#&*{}[]<>|+-$$$$";

export function BrainAnimation({ size = 500 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Portrait canvas — same proportions as a fingertip
    const W = Math.round(size * 0.80);
    const H = size;
    canvas.width  = W;
    canvas.height = H;

    const CW = 8;   // char cell width
    const CH = 12;  // char cell height
    const COLS = Math.floor(W / CW);
    const ROWS = Math.floor(H / CH);

    const cx    = W / 2;
    const cy    = H * 0.50;
    const MAX_RX = W * 0.455;  // outer oval half-widths
    const MAX_RY = H * 0.470;

    // Fingerprint ring parameters
    const RING_PITCH = 13;   // px between ring centres (ridge + valley)
    const RIDGE_W    = 7.5;  // px of ridge per cycle  (rest is valley)

    function isOnRidge(col: number, row: number): boolean {
      const dx = (col + 0.5) * CW - cx;
      const dy = (row + 0.5) * CH - cy;

      // Outside overall oval? → skip
      if ((dx / MAX_RX) ** 2 + (dy / MAX_RY) ** 2 > 1) return false;

      // Ellipse-adjusted radial distance (rescale y so it matches x scale)
      const eDist = Math.sqrt(dx * dx + (dy * MAX_RX / MAX_RY) ** 2);

      // Slight organic warp: offset phase by angle
      const angle = Math.atan2(dy, dx);
      const warp  = Math.sin(angle * 3) * 1.5 + Math.cos(angle * 5) * 0.8;

      return ((eDist + warp) % RING_PITCH) < RIDGE_W;
    }

    /* ── Character grid ── */
    const grid = Array.from({ length: COLS * ROWS }, () => ({
      char:  CHARS[Math.floor(Math.random() * CHARS.length)],
      alpha: 0.45 + Math.random() * 0.55,
      rate:  0.004 + Math.random() * 0.026,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0, raf = 0;
    const HOVER_R = 58;  // px radius of the fading patch around cursor

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
      ctx!.font = `bold 10px "Courier New", Courier, monospace`;
      t += 0.014;

      const mouse = mouseRef.current;

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (!isOnRidge(col, row)) continue;

          const cell = grid[row * COLS + col];
          if (Math.random() < cell.rate) {
            cell.char = CHARS[Math.floor(Math.random() * CHARS.length)];
            if (Math.random() < 0.05) cell.alpha = 0.45 + Math.random() * 0.55;
          }

          const pulse = 0.76 + 0.24 * Math.sin(t * 1.2 + cell.phase);
          let a = Math.min(1, cell.alpha * pulse);

          // Cursor patch: smooth quadratic fade in a circle around cursor
          if (mouse) {
            const px = (col + 0.5) * CW;
            const py = (row + 0.5) * CH;
            const dist = Math.sqrt((px - mouse.x) ** 2 + (py - mouse.y) ** 2);
            if (dist < HOVER_R) {
              const norm = dist / HOVER_R;         // 0 = centre, 1 = edge
              a *= norm * norm;                     // quadratic: near-invisible at cursor
            }
          }

          if (a < 0.015) continue;

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
      width={Math.round(size * 0.80)}
      height={size}
      style={{
        display: "block",
        cursor: "crosshair",
        filter:
          "drop-shadow(0 0 30px rgba(0,210,175,0.55)) drop-shadow(0 0 70px rgba(0,210,175,0.18))",
      }}
    />
  );
}
