import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

// One font family for the whole UI (D2).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cowrie Log Summarizer",
  description:
    "Defensive learning project: a local SSH honeypot plus an AI that summarizes attacker behavior for defenders.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
