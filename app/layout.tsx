import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PreFlight: check a tokenized stock trade before you make it",
  description: "Pre-trade safety gate for tokenized stocks on BNB Smart Chain. MCP server, policies and tamper-evident receipts.",
};

// suppressHydrationWarning on <html>: browser extensions such as Dark Reader add attributes to it before React loads.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}