"use client";
import { useEffect, useRef } from "react";

const CHARS = "01ABCDEFabcdef@#$%&*(){}[]<>/\\|+-=_~^`!?;:.,0xBASE64";

export function BrainAnimation({ size = 480 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = size;
    const H = size;
    const CW = 9;   // char cell width
    const CH = 14;  // char cell height
    const COLS = Math.floor(W / CW);
    const ROWS = Math.floor(H / CH);

    /* ── Build brain-shaped mask on an offscreen canvas ── */
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const offCtx = off.getContext("2d")!;

    const cx = W / 2;
    const cy = H * 0.46;
    const rx = W * 0.40;
    const ry = H * 0.43;

    offCtx.fillStyle = "#fff";
    offCtx.save();
    offCtx.translate(cx, cy);
    offCtx.beginPath();
    // Brain outline — bezier approximation of a human brain (top view)
    offCtx.moveTo(0, ry * 0.78);                                         // bottom centre
    offCtx.bezierCurveTo(-rx * 0.35, ry * 0.88, -rx * 0.88, ry * 0.52, -rx * 0.98, 0);
    offCtx.bezierCurveTo(-rx * 1.02, -ry * 0.34, -rx * 0.86, -ry * 0.74, -rx * 0.36, -ry * 0.97);
    offCtx.bezierCurveTo(-rx * 0.10, -ry * 1.05, rx * 0.10, -ry * 1.05, rx * 0.36, -ry * 0.97);
    offCtx.bezierCurveTo(rx * 0.86, -ry * 0.74, rx * 1.02, -ry * 0.34, rx * 0.98, 0);
    offCtx.bezierCurveTo(rx * 0.88, ry * 0.52, rx * 0.35, ry * 0.88, 0, ry * 0.78);
    offCtx.fill();
    offCtx.restore();

    const px = offCtx.getImageData(0, 0, W, H).data;
    function inBrain(col: number, row: number): boolean {
      const x = Math.round((col + 0.5) * CW);
      const y = Math.round((row + 0.5) * CH);
      if (x < 0 || x >= W || y < 0 || y >= H) return false;
      return px[(y * W + x) * 4 + 3] > 128;
    }

    /* ── Character grid ── */
    const grid = Array.from({ length: COLS * ROWS }, (_, i) => ({
      char:   CHARS[Math.floor(Math.random() * CHARS.length)],
      alpha:  0.12 + Math.random() * 0.88,
      rate:   0.004 + Math.random() * 0.038,
      phase:  Math.random() * Math.PI * 2,
      col:    i % COLS,
    }));

    const midCol = COLS / 2;
    let t = 0, raf = 0;

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      ctx!.font = `bold 11px "Courier New", Courier, monospace`;
      t += 0.018;

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (!inBrain(col, row)) continue;

          const cell = grid[row * COLS + col];
          if (Math.random() < cell.rate) {
            cell.char = CHARS[Math.floor(Math.random() * CHARS.length)];
            if (Math.random() < 0.08) cell.alpha = 0.12 + Math.random() * 0.88;
          }

          // Pulse brightness
          const pulse = 0.72 + 0.28 * Math.sin(t * 1.4 + cell.phase);
          const a = Math.min(1, cell.alpha * pulse);
          const dist = Math.abs(col - midCol);

          let r = 0, g = 220, b = 180;
          if (dist < 0.8) {
            // Centre dividing line — bright aqua
            ctx!.fillStyle = `rgba(0,255,215,${Math.min(1, a * 1.7)})`;
          } else if (dist < 2.5) {
            ctx!.fillStyle = `rgba(${r},${g + 20},${b + 10},${Math.min(1, a * 1.25)})`;
          } else {
            ctx!.fillStyle = `rgba(${r},${g},${b},${a * 0.9})`;
          }

          ctx!.fillText(cell.char, col * CW, (row + 1) * CH - 2);
        }
      }
      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        display: "block",
        filter: "drop-shadow(0 0 40px rgba(0,220,180,0.35)) drop-shadow(0 0 80px rgba(0,220,180,0.15))",
      }}
    />
  );
}
