"use client";
import { useEffect, useRef } from "react";

const CHARS = "01ABCDEFabcdef@#$%&*(){}[]<>/\\|+-=_~^`!?;:.,";

export function BrainAnimation({ size = 480 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = size;
    const H = size;
    const CW = 9;
    const CH = 14;
    const COLS = Math.floor(W / CW);
    const ROWS = Math.floor(H / CH);

    /* ──────────────────────────────────────────────────────────────
       Two-hemisphere mask.
       Each hemisphere = organic brain lobe shape drawn as bezier.
       A clear vertical gap runs down the exact centre.
    ─────────────────────────────────────────────────────────────── */
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const oc = off.getContext("2d")!;

    const cx   = W / 2;
    const cy   = H * 0.48;
    const gap  = Math.ceil(CW * 1.8);  // ~1.8 char-cell gap each side of centre
    const rw   = W * 0.38;             // radius x per hemisphere
    const rh   = H * 0.42;             // radius y

    oc.fillStyle = "#fff";

    // ── Left hemisphere ──────────────────────────────────────────
    //   medial (right) edge = cx − gap
    //   lateral (left) edge = cx − gap − 2*rw
    oc.save();
    oc.translate(cx - gap, cy);
    oc.beginPath();
    // Start at medial bottom
    oc.moveTo(0,     rh * 0.70);
    // Bottom curve to lateral
    oc.bezierCurveTo(-rw * 0.25, rh * 0.92, -rw * 0.80, rh * 0.60, -rw * 1.00, rh * 0.05);
    // Up the lateral side
    oc.bezierCurveTo(-rw * 1.06, -rh * 0.32, -rw * 0.92, -rh * 0.72, -rw * 0.48, -rh * 0.96);
    // Across the top
    oc.bezierCurveTo(-rw * 0.18, -rh * 1.06, -rw * 0.02, -rh * 1.00, 0, -rh * 0.82);
    // Medial edge (inner) — slight concavity inward
    oc.bezierCurveTo(rw * 0.06, -rh * 0.44, rw * 0.06, rh * 0.32, 0, rh * 0.70);
    oc.fill();
    oc.restore();

    // ── Right hemisphere (mirror) ─────────────────────────────────
    oc.save();
    oc.translate(cx + gap, cy);
    oc.beginPath();
    oc.moveTo(0,    rh * 0.70);
    // Medial edge (inner)
    oc.bezierCurveTo(-rw * 0.06, rh * 0.32, -rw * 0.06, -rh * 0.44, 0, -rh * 0.82);
    // Top
    oc.bezierCurveTo(rw * 0.02, -rh * 1.00, rw * 0.18, -rh * 1.06, rw * 0.48, -rh * 0.96);
    // Up lateral side
    oc.bezierCurveTo(rw * 0.92, -rh * 0.72, rw * 1.06, -rh * 0.32, rw * 1.00, rh * 0.05);
    // Bottom
    oc.bezierCurveTo(rw * 0.80, rh * 0.60, rw * 0.25, rh * 0.92, 0, rh * 0.70);
    oc.fill();
    oc.restore();

    const imgData = oc.getImageData(0, 0, W, H).data;
    function inBrain(col: number, row: number): boolean {
      const x = Math.round((col + 0.5) * CW);
      const y = Math.round((row + 0.5) * CH);
      if (x < 0 || x >= W || y < 0 || y >= H) return false;
      return imgData[(y * W + x) * 4 + 3] > 128;
    }

    // Determine which side each column belongs to
    const midCol = COLS / 2;

    /* ── Character grid ── */
    const grid = Array.from({ length: COLS * ROWS }, () => ({
      char:  CHARS[Math.floor(Math.random() * CHARS.length)],
      alpha: 0.35 + Math.random() * 0.65,   // brighter base
      rate:  0.003 + Math.random() * 0.032,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0, raf = 0;

    const onEnter = () => { hoveredRef.current = true; };
    const onLeave = () => { hoveredRef.current = false; };
    canvas.addEventListener("mouseenter", onEnter);
    canvas.addEventListener("mouseleave", onLeave);

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      ctx!.font = `bold 11px "Courier New", Courier, monospace`;
      t += 0.016;

      const dimmed = hoveredRef.current;

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (!inBrain(col, row)) continue;

          const cell = grid[row * COLS + col];

          if (Math.random() < cell.rate) {
            cell.char = CHARS[Math.floor(Math.random() * CHARS.length)];
            if (Math.random() < 0.06) cell.alpha = 0.15 + Math.random() * 0.85;
          }

          const pulse = 0.72 + 0.28 * Math.sin(t * 1.3 + cell.phase);
          let a = Math.min(1, cell.alpha * pulse);
          // Hover: dim to ~30% — visibly darker but shape stays readable
          if (dimmed) a *= 0.30;

          // Left hemisphere: teal-blue tint; right: teal-green tint
          const isLeft = col < midCol;
          const g = isLeft ? 208 : 220;
          const b = isLeft ? 195 : 158;

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
      width={size}
      height={size}
      style={{
        display: "block",
        cursor: "default",
        filter: "drop-shadow(0 0 32px rgba(0,220,180,0.50)) drop-shadow(0 0 70px rgba(0,220,180,0.22))",
      }}
    />
  );
}
