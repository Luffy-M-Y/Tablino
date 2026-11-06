import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const jakarta = localFont({
  src: "../fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Tablino Admin",
  description: "Dashboard administration Tablino",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
