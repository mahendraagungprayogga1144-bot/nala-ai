import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/sales/orders/*/nota": ["./lib/henima-sales/fonts/**/*"],
    "/api/telegram/webhook": ["./lib/henima-sales/fonts/**/*"],
  },
};

export default nextConfig;
