import type { CapacitorConfig } from "@capacitor/cli";

/**
 * App lapangan: hanya pintu /t (Sales Portal), bukan homepage Gercep OS.
 * Navigasi ke /dashboard dll diblok di proxy + FieldAppGuard.
 */
const config: CapacitorConfig = {
  appId: "id.gercepos.henima.sales",
  appName: "Henima Sales",
  webDir: "www",
  server: {
    // Entry field-only — jangan root situs (bisa ke login/dashboard).
    url: process.env.HENIMA_MOBILE_URL || "https://www.gercepos.id/t",
    cleartext: false,
    allowNavigation: ["gercepos.id", "www.gercepos.id", "*.gercepos.id", "*.vercel.app"],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#F7F7F5",
    // Bridge lama: background-geolocation + plugin custom lebih stabil di OEM Indonesia.
    useLegacyBridge: true,
  },
  plugins: {
    Geolocation: {
      // Izin lokasi akurat untuk tracking lapangan.
    },
  },
};

export default config;
