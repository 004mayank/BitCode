import type { ReactNode } from "react";

// Marketing pages (landing) — no sidebar, full-page canvas
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`html,body{background:#000;margin:0;padding:0}`}</style>
      {children}
    </>
  );
}
