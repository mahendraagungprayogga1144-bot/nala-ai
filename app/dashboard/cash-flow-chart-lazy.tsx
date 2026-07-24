"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const CashFlowChart = dynamic(() => import("./cash-flow-chart"), {
  ssr: false,
  loading: () => <div className="mb-6 h-48 animate-pulse rounded-2xl bg-white/[0.04]" />,
});

export default function CashFlowChartLazy(
  props: ComponentProps<typeof CashFlowChart>,
) {
  return <CashFlowChart {...props} />;
}
