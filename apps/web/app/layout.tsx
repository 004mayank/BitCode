import "./globals.css";
import type { ReactNode } from "react";
import { SidebarNav } from "../components/SidebarNav";

export const metadata = {
  title: "BitCode — AI-native Dev Platform",
  description: "Train with AI. Solve real problems. Get evaluated on how you think."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <SidebarNav />
          <div className="main-content">
            <div className="page">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
