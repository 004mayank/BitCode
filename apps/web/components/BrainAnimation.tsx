"use client";
import { useEffect, useRef } from "react";

// Dense character set
const CHARS = "$$@@%%##&&WWMMBBZZhhnjkwm01ABCDEFabcdef*{}[]<>|+-";

// 2× retina render — crisp at all resolutions
const DISPLAY_SCALE = 0.5;

export function BrainAnimation({ size = 540 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Square canvas buffer at 2× for retina sharpness
    const W = size / DISPLAY_SCALE;
    const H = size / DISPLAY_SCALE;
    canvas.width  = W;
    canvas.height = H;

    const CW = 10;  // char cell width  (canvas px)
    const CH = 14;  // char cell height (canvas px)
    const COLS = Math.floor(W / CW);
    const ROWS = Math.floor(H / CH);

    // Brain geometry — centre, overall extents
    const cx = W / 2;
    const cy = H * 0.50;

    // Each hemisphere:
    //   lobeRX × lobeRY ellipse, centres offset ±lobeShift from cx
    // These values produce a brain where each lobe is taller than wide
    // (matching a real top-view brain) while the combined shape is nearly
    // square overall — matching the reference image.
    const lobeRX    = W * 0.24;   // narrow (left-right) per lobe
    const lobeRY    = H * 0.42;   // tall   (front-back) per lobe
    const lobeShift = W * 0.21;   // separation of each lobe centre from cx

    // Overall extents (for depth weighting / fissure)
    const RX = lobeShift + lobeRX;  // ≈ W*0.45 total half-width
    const RY = lobeRY;              // ≈ H*0.42 total half-height

    // ─────────────────────────────────────────────────────────────────────
    // lobeBoundary — organic radial modulation creating gyri / sulci.
    // Returns a normalised factor ≈ 0.85–1.02.
    // `side` (+1/-1) adds a small phase offset so lobes aren't mirror-perfect.
    // ─────────────────────────────────────────────────────────────────────
    function lobeBoundary(th: number, side: number): number {
      const p = side * 0.3;
      return (
        0.91
        + 0.055 * Math.cos(th * 2 + p + 0.5)
        + 0.045 * Math.cos(th * 3 - 0.5)
        + 0.035 * Math.sin(th * 4 + 1.1)
        + 0.025 * Math.cos(th * 5 - 0.9)
        + 0.018 * Math.sin(th * 7 + 0.4)
        + 0.012 * Math.cos(th * 9 + 2.3)
        + 0.008 * Math.sin(th * 12 - 1.0)
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // isInBrain — two hemisphere blobs with a tapering longitudinal fissure.
    // ─────────────────────────────────────────────────────────────────────
    function isInBrain(px: number, py: number): boolean {
      // ── Longitudinal fissure ──────────────────────────────────────────
      // Runs from the crown (normY=-1) and tapers to zero at normY=0.30.
      const normY = (py - cy) / RY;
      if (normY < 0.30) {
        const taper = Math.min(1, Math.max(0, (0.30 - normY) / 1.30));
        const halfGap = RX * 0.030 * taper;
        if (Math.abs(px - cx) < halfGap) return false;
      }

      // ── Left hemisphere ───────────────────────────────────────────────
      {
        const dx = px - (cx - lobeShift);
        const dy = py - cy;
        const nx = dx / lobeRX;
        const ny = dy / lobeRY;
        const r  = Math.sqrt(nx * nx + ny * ny);
        const th = Math.atan2(ny, nx);
        if (r < lobeBoundary(th, -1)) return true;
      }

      // ── Right hemisphere ──────────────────────────────────────────────
      {
        const dx = px - (cx + lobeShift);
        const dy = py - cy;
        const nx = dx / lobeRX;
        const ny = dy / lobeRY;
        const r  = Math.sqrt(nx * nx + ny * ny);
        const th = Math.atan2(ny, -nx);  // mirrored for symmetry
        if (r < lobeBoundary(th, +1)) return true;
      }

      return false;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Per-cell state
    // ─────────────────────────────────────────────────────────────────────
    const grid = Array.from({ length: COLS * ROWS }, () => ({
      char:  CHARS[Math.floor(Math.random() * CHARS.length)],
      alpha: 0.55 + Math.random() * 0.45,
      rate:  0.006 + Math.random() * 0.024,
      phase: Math.random() * Math.PI * 2,
    }));

    const depthWeight = new Float32Array(COLS * ROWS);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const dx = (col + 0.5) * CW - cx;
        const dy = (row + 0.5) * CH - cy;
        const d  = Math.sqrt((dx / RX) ** 2 + (dy / RY) ** 2);
        depthWeight[row * COLS + col] = Math.max(0, 1 - d * 0.6);
      }
    }

    let t = 0, raf = 0;
    const HOVER_R = 120;

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left)  * (W / rect.width),
        y: (e.clientY - rect.top)   * (H / rect.height),
      };
    };
    const onLeave = () => { mouseRef.current = null; };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      ctx!.font = `bold 13px "Courier New", Courier, monospace`;
      t += 0.011;

      const mouse = mouseRef.current;

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const px = (col + 0.5) * CW;
          const py = (row + 0.5) * CH;

          if (!isInBrain(px, py)) continue;

          const idx  = row * COLS + col;
          const cell = grid[idx];

          if (Math.random() < cell.rate) {
            cell.char = CHARS[Math.floor(Math.random() * CHARS.length)];
          }

          const pulse = 0.90 + 0.10 * Math.sin(t * 1.2 + cell.phase);
          const depth = 0.70 + 0.30 * depthWeight[idx];
          let a = Math.min(1, cell.alpha * pulse * depth);

          if (mouse) {
            const dist = Math.sqrt((px - mouse.x) ** 2 + (py - mouse.y) ** 2);
            if (dist < HOVER_R) {
              const norm = dist / HOVER_R;
              a *= norm * norm;
            }
          }

          if (a < 0.02) continue;
          ctx!.fillStyle = `rgba(0,210,175,${a.toFixed(3)})`;
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
      width={size / DISPLAY_SCALE}
      height={size / DISPLAY_SCALE}
      style={{
        display: "block",
        cursor: "crosshair",
        width:  size,
        height: size,
        filter:
          "drop-shadow(0 0 40px rgba(0,210,175,0.55)) drop-shadow(0 0 90px rgba(0,210,175,0.18))",
      }}
    />
  );
}
