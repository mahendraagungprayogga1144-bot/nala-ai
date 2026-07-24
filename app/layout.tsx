import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PwaRegister from "./components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.gercepos.id"),
  title: {
    default: "Gercep AI — Aplikasi Bisnis UMKM",
    template: "%s · Gercep AI",
  },
  description:
    "Platform bisnis untuk UMKM Indonesia: inventory, kasir, keuangan, dan AI khusus jenis usaha. Siap dipakai di HP & desktop.",
  applicationName: "Gercep AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Gercep AI",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Gercep AI",
    title: "Gercep AI — Aplikasi Bisnis UMKM",
    description: "Inventory, kasir, keuangan, dan AI untuk pembisnis Indonesia.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070711" },
    { media: "(prefers-color-scheme: light)", color: "#070711" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full min-h-[100dvh] flex-col overscroll-none">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
