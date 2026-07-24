"use client";

import dynamic from "next/dynamic";

const AgriCharts = dynamic(() => import("./agri-charts"), {
  ssr: false,
  loading: () => <div className="mb-4 h-48 animate-pulse rounded-2xl bg-white/[0.04]" />,
});

export default AgriCharts;
