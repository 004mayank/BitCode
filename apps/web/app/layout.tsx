import "./globals.css";
import type { ReactNode } from "react";
import { SidebarNav } from "../components/SidebarNav";
import { ThemeToggle } from "../components/ThemeToggle";

export const metadata = {
  title: "BitCode — AI-native Dev Platform",
  description: "Train with AI. Solve real problems. Get evaluated on how you think."
};

// Injected before paint to prevent flash of wrong theme
const themeScript = `(function(){
  var t = localStorage.getItem('bc-theme') || 'dark';
  document.documentElement.dataset.theme = t;
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="app-shell">
          <SidebarNav />
          <div className="main-content">
            {/* Top bar — same 48 px height as sidebar logo row */}
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
      </body>
    </html>
  );
}
