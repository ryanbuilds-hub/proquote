import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProQuote — quoting for trades",
  description: "Manage trade clients and build quotes from one simple workspace.",
  applicationName: "ProQuote",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ProQuote",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f2763e",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IE">
      <body>{children}</body>
    </html>
  );
}
