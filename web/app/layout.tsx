import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "katex/dist/katex.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AIEvalLearnPath",
  description: "A 28-lesson curriculum on LLM evaluation.",
  applicationName: "AIEvalLearnPath",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AIEvalPath",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  formatDetection: { telephone: false },
  other: {
    // Older iOS Safari only honors the apple-prefixed name when deciding
    // whether "Add to Home Screen" should launch in standalone mode.
    // Next.js emits the modern unprefixed `mobile-web-app-capable`; we
    // emit both for broadest compatibility.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
