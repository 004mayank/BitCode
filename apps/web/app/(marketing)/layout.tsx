import type { ReactNode } from "react";

// Marketing pages (landing) — no sidebar, full-page canvas
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
