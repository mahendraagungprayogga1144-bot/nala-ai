import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import FieldScrollUnlock from "./field-scroll-unlock";
import FieldAppGuard from "./field-app-guard";

/**
 * Shell khusus link lapangan (/t/...) biar Chrome HP bisa di-scroll
 * + kunci app Cap agar tidak masuk Gercep OS internal.
 * Metadata PWA: iPhone bisa “Tambah ke Layar Utama” sebagai Henima Sales.
 */
export const metadata: Metadata = {
  title: "Henima Sales",
  applicationName: "Henima Sales",
  description: "App sales lapangan HENIMA — GPS, catat jual, bayar, laporan.",
  manifest: "/t/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Henima Sales",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F7F7F5",
};

export default function FieldLinkLayout({ children }: { children: ReactNode }) {
  return (
    <div className="henima-field-shell min-h-[100dvh] overflow-x-hidden bg-[#F7F7F5] text-[#111111]">
      <FieldScrollUnlock />
      <FieldAppGuard />
      {children}
    </div>
  );
}
