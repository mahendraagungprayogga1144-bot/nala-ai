import type { CapacitorConfig } from "@capacitor/cli";

/**
 * App membungkus situs live Gercep/Henima.
 * Sales buka link /t/{token} di dalam WebView + GPS native background.
 */
const config: CapacitorConfig = {
  appId: "id.gercepos.henima.sales",
  appName: "Henima Sales",
  webDir: "www",
  server: {
    // Ganti ke preview/staging lewat env bila perlu.
    url: process.env.HENIMA_MOBILE_URL || "https://gercepos.id",
    cleartext: false,
    allowNavigation: ["gercepos.id", "*.gercepos.id", "*.vercel.app"],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#08080f",
  },
  plugins: {
    Geolocation: {
      // Izin lokasi akurat untuk tracking lapangan.
    },
  },
};

export default config;
