import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import "./globals.css";
import { TenantGate } from "@/components/layout/TenantGate";

const jakarta = localFont({
  src: "../fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Tablino — Archive universitaire",
  description: "Consultez et téléchargez vos cours et devoirs universitaires.",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Tablino",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`h-full antialiased ${jakarta.variable}`}>
      <body className="min-h-full flex flex-col bg-[color:var(--color-page-background)] text-[color:var(--color-text)]">
        <Suspense
          fallback={
            <main
              id="main-content"
              aria-busy="true"
              className="flex flex-1 items-center justify-center px-4 py-16"
            >
              <p className="sr-only">Chargement…</p>
            </main>
          }
        >
          <TenantGate>{children}</TenantGate>
        </Suspense>
      </body>
    </html>
  );
}
