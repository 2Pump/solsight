import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/shared/providers";
import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "SolSight — Signal intelligence for Solana memecoins",
    template: "%s · SolSight",
  },
  description:
    "Rug screening, bubble maps, AI chart reading, and deep wallet tracking — one radar for Solana memecoin signals.",
  openGraph: {
    title: "SolSight — Signal intelligence for Solana memecoins",
    description:
      "Rug screening, bubble maps, AI chart reading, and deep wallet tracking in one beautiful dashboard.",
    images: ["/og/cover.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SolSight",
    description: "Signal intelligence for Solana memecoins.",
    images: ["/og/cover.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${display.variable} ${sans.variable} ${mono.variable} min-h-screen`}>
        <Providers>
          <SiteHeader />
          <main className="min-h-screen">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
