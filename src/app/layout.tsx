import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Newsreader, Outfit } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { SessionProvider } from "@/lib/session";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-display-face",
  adjustFontFallback: true,
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-sans-face",
  adjustFontFallback: true,
});

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono-face",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: {
    default: "Forge Layer",
    template: "%s — Forge Layer",
  },
  description:
    "Forge Layer is a public authenticity dispute registry on GenLayer. Stake GEN on a claim, face a challenge, let validators inspect the work.",
  applicationName: "Forge Layer",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Forge Layer",
    description:
      "A public ledger for AI-versus-human disputes. File a claim, back it with GEN, let validators write a durable verdict.",
    siteName: "Forge Layer",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${outfit.variable} ${plex.variable}`}>
      <body>
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
