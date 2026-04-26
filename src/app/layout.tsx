import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Theami — what to look out for in this SF block",
  description:
    "Theami answers one question for any San Francisco address: what should I look out for here, and on what time horizon? Authoritative city/state/federal data, no scoring, every claim sourced.",
  metadataBase: new URL("https://theami.ai"),
  openGraph: {
    title: "Theami — SF real estate guide",
    description:
      "What to look out for at any San Francisco address. Real data, plain English, every claim sourced.",
    type: "website",
    url: "https://theami.ai",
  },
  twitter: { card: "summary_large_image", title: "Theami" },
};

export const viewport: Viewport = {
  themeColor: "#fafaf7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
