import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { brand } from "@/lib/branding";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.subhead,
  openGraph: {
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.subhead,
    type: "website",
    siteName: brand.name,
  },
  twitter: { card: "summary_large_image", title: brand.name, description: brand.subhead },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
