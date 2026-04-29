import type { ReactNode } from "react";
import { SidebarNav } from "../../components/SidebarNav";
import { ThemeToggle } from "../../components/ThemeToggle";

// App shell — sidebar + topbar — used by all authenticated/dashboard pages
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <SidebarNav />
      <div className="main-content">
        {/* Top bar */}
        <div style={{
          height: 48,
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "0 28px",
          gap: 10,
          background: "var(--surface)",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <ThemeToggle />
        </div>
        <div className="page">{children}</div>
      </div>
    </div>
  );
}
