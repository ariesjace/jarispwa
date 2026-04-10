import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import ServiceWorkerRegister from "@/app/components/ServiceWorkerRegister";
import "./globals.css";

// Fonts
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadata
export const metadata: Metadata = {
  title: "JARIS CMS",
  description: "Internal CMS app for Disruptive Solutions Inc.",
  manifest: "/manifest.json",
  icons: {
    icon: "/jarislogo.png",
    shortcut: "/jarislogo.png",
    apple: "/jarislogo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Jaris",
  },
  formatDetection: {
    telephone: false,
  },
};

// viewport-fit=cover is REQUIRED to make env(safe-area-inset-*) work on iOS
// Without it the browser masks the notch/home-indicator area and the CSS vars
// always resolve to 0.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563EB",
  viewportFit: "cover", // ← unlocks safe-area-inset env() on iOS PWA
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/jarislogo.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Jaris" />
      </head>

      <body
        className="w-full flex flex-col"
        style={{
          minHeight: "100vh",
          touchAction: "manipulation",
          overflowX: "hidden",
        }}
      >
        <ServiceWorkerRegister />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}