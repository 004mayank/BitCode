import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "BitCode - AI-native Dev Platform",
  description: "Train with AI. Solve real problems. Get evaluated on how you think.",
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
      <body>{children}</body>
    </html>
  );
}
