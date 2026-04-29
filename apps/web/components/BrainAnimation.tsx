"use client";
import { useEffect, useRef } from "react";

// Heavy on $ like the reference, mixed with hex/code chars
const CHARS = "$$$$$$SBZhnjkwm$$$01ABCDEFabcdef$$$@#&*{}[]<>|+-$$$";

export function BrainAnimation({ size = 500 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Portrait canvas: narrower width, taller height
    const W = Math.round(size * 0.78);
    const H = size;
    canvas.width  = W;
    canvas.height = H;

    const CW = 8;   // char cell width  (smaller → denser)
    const CH = 12;  // char cell height
    const COLS = Math.floor(W / CW);
    const ROWS = Math.floor(H / CH);

    /* ──────────────────────────────────────────────────────
       Build tall-oval brain mask on an offscreen canvas.
       One single oval shape; the fissure is just 1 column
       of skipped cells at the exact centre.
    ────────────────────────────────────────────────────── */
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const oc = off.getContext("2d")!;

    const cx = W / 2;
    const cy = H * 0.50;
    const rx = W * 0.46;   // horizontal radius
    const ry = H * 0.47;   // vertical radius

    oc.fillStyle = "#fff";

    // Organic brain outline — single closed bezier path
    oc.beginPath();
    oc.moveTo(cx, cy - ry);                                          // top centre
    // Top-right quadrant
    oc.bezierCurveTo(
      cx + rx * 0.60, cy - ry * 1.02,
      cx + rx * 1.05, cy - ry * 0.55,
      cx + rx,        cy
    );
    // Bottom-right
    oc.bezierCurveTo(
      cx + rx * 1.02, cy + ry * 0.48,
      cx + rx * 0.62, cy + ry * 0.94,
      cx + rx * 0.10, cy + ry * 0.88
    );
    // Bottom notch (brain stem area)
    oc.bezierCurveTo(
      cx + rx * 0.05, cy + ry * 0.98,
      cx - rx * 0.05, cy + ry * 0.98,
      cx - rx * 0.10, cy + ry * 0.88
    );
    // Bottom-left
    oc.bezierCurveTo(
      cx - rx * 0.62, cy + ry * 0.94,
      cx - rx * 1.02, cy + ry * 0.48,
      cx - rx,        cy
    );
    // Top-left
    oc.bezierCurveTo(
      cx - rx * 1.05, cy - ry * 0.55,
      cx - rx * 0.60, cy - ry * 1.02,
      cx,             cy - ry
    );
    oc.fill();

    const imgData = oc.getImageData(0, 0, W, H).data;
    function inBrain(col: number, row: number): boolean {
      const x = Math.round((col + 0.5) * CW);
      const y = Math.round((row + 0.5) * CH);
      if (x < 0 || x >= W || y < 0 || y >= H) return false;
      return imgData[(y * W + x) * 4 + 3] > 128;
    }

    const midCol = COLS / 2;

    /* ── Character grid ── */
    const grid = Array.from({ length: COLS * ROWS }, () => ({
      char:  CHARS[Math.floor(Math.random() * CHARS.length)],
      alpha: 0.40 + Math.random() * 0.60,
      rate:  0.004 + Math.random() * 0.030,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0, raf = 0;

    const onEnter = () => { hoveredRef.current = true; };
    const onLeave = () => { hoveredRef.current = false; };
    canvas.addEventListener("mouseenter", onEnter);
    canvas.addEventListener("mouseleave", onLeave);

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      ctx!.font = `bold 10px "Courier New", Courier, monospace`;
      t += 0.014;

      const dimmed = hoveredRef.current;

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (!inBrain(col, row)) continue;

          // Fissure: skip exactly the centre column
          const distFromMid = Math.abs(col - midCol);
          if (distFromMid < 0.8) continue;

          const cell = grid[row * COLS + col];
          if (Math.random() < cell.rate) {
            cell.char  = CHARS[Math.floor(Math.random() * CHARS.length)];
            if (Math.random() < 0.05) cell.alpha = 0.40 + Math.random() * 0.60;
          }

          const pulse = 0.75 + 0.25 * Math.sin(t * 1.2 + cell.phase);
          let a = Math.min(1, cell.alpha * pulse);
          if (dimmed) a *= 0.28;   // hover: dim but still visible

          // Slight teal tint difference: left cooler, right warmer
          const isLeft = col < midCol;
          const g = isLeft ? 205 : 218;
          const b = isLeft ? 192 : 155;

          ctx!.fillStyle = `rgba(0,${g},${b},${a})`;
          ctx!.fillText(cell.char, col * CW, (row + 1) * CH - 2);
        }
      }

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mouseenter", onEnter);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.round(size * 0.78)}
      height={size}
      style={{
        display: "block",
        cursor: "default",
        filter:
          "drop-shadow(0 0 28px rgba(0,210,175,0.55)) drop-shadow(0 0 65px rgba(0,210,175,0.20))",
      }}
    />
  );
}
