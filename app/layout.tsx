import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentic 7a98c897",
  description: "Lightweight AI Agent (wiki, weather, calc) with optional LLM fallback"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
