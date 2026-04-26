import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "BitCode",
  description: "AI-native developer platform"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>BitCode</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>AI-native dev challenges</div>
            </div>
            <nav style={{ display: "flex", gap: 12, fontSize: 14 }}>
              <a href="/" style={{ color: "#e5e7eb", textDecoration: "none" }}>Dashboard</a>
              <a href="/leaderboard" style={{ color: "#e5e7eb", textDecoration: "none" }}>Leaderboard</a>
              <a href="/bounties" style={{ color: "#e5e7eb", textDecoration: "none" }}>Bounties</a>
              <a href="/auth" style={{ color: "#e5e7eb", textDecoration: "none" }}>Auth</a>
            </nav>
          </header>
          <main style={{ marginTop: 18 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
