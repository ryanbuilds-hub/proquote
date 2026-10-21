import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProQuote — quoting for trades",
  description: "Manage trade clients and build quotes from one simple workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IE">
      <body>{children}</body>
    </html>
  );
}
