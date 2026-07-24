"use client";

import dynamic from "next/dynamic";

const loading = () => (
  <div className="h-40 animate-pulse rounded-2xl border border-white/[0.06] bg-[#0D0D1A]" />
);

export const LivestockInventoryLazy = dynamic(() => import("./livestock-inventory"), { loading });
export const HomeIndustryInventoryLazy = dynamic(() => import("./home-industry-inventory"), { loading });
export const FnBInventoryLazy = dynamic(() => import("./fnb-inventory"), { loading });
export const AgricultureInventoryLazy = dynamic(() => import("./agriculture-inventory"), { loading });
export const RetailInventoryLazy = dynamic(() => import("./retail-inventory"), { loading });
export const JasaInventoryLazy = dynamic(() => import("./jasa-inventory"), { loading });
export const WholesaleInventoryLazy = dynamic(() => import("./wholesale-inventory"), { loading });
export const OlshopInventoryLazy = dynamic(() => import("./olshop-inventory"), { loading });
export const KesehatanInventoryLazy = dynamic(() => import("./kesehatan-inventory"), { loading });
export const BengkelInventoryLazy = dynamic(() => import("./bengkel-inventory"), { loading });
