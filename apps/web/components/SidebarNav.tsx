"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV = [
  { href: "/", label: "Dashboard", icon: "⊞" },
  { href: "/challenges", label: "Challenges", icon: "⚡" },
  { href: "/bounties", label: "Bounties", icon: "◎" },
  { href: "/leaderboard", label: "Leaderboard", icon: "▲" },
  { href: "/profile", label: "Profile", icon: "◉" },
];

export function SidebarNav() {
  const path = usePathname();

  function isActive(href: string) {
    if (href === "/") return path === "/";
    return path.startsWith(href);
  }

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div style={{ padding: "20px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, color: "#fff"
          }}>B</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.1 }}>BitCode</div>
            <div style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: "0.06em" }}>AI DEV PLATFORM</div>
          </div>
        </div>
      </div>

      <hr className="divider" style={{ margin: "0 0 8px" }} />

      {/* Nav links */}
      <div style={{ flex: 1 }}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link${isActive(item.href) ? " active" : ""}`}
          >
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
          Use AI effectively.<br />
          Get scored on how.
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
          <Link href="/auth" className="btn secondary sm" style={{ flex: 1, justifyContent: "center" }}>
            Sign in
          </Link>
        </div>
      </div>
    </nav>
  );
}
