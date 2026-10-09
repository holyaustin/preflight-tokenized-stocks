import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PreFlight: check a tokenized stock trade before you make it",
  description: "Pre-trade safety gate for tokenized stocks on BNB Smart Chain. MCP server, policies and tamper-evident receipts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
