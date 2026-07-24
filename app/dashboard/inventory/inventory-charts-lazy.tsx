"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const pulse = <div className="mb-4 h-40 animate-pulse rounded-2xl bg-white/[0.04]" />;

const InventoryCharts = dynamic(() => import("./inventory-charts"), {
  ssr: false,
  loading: () => pulse,
});
const TrendChart = dynamic(() => import("./trend-chart"), {
  ssr: false,
  loading: () => pulse,
});
const RecentMovements = dynamic(() => import("./recent-movements"), {
  ssr: false,
  loading: () => <div className="mb-4 h-32 animate-pulse rounded-2xl bg-white/[0.04]" />,
});
const MovementsChart = dynamic(() => import("./movements-chart"), {
  ssr: false,
  loading: () => pulse,
});
const LossBreakdownChart = dynamic(() => import("./loss-breakdown-chart"), {
  ssr: false,
  loading: () => pulse,
});

export function InventoryChartsLazy(props: ComponentProps<typeof InventoryCharts>) {
  return <InventoryCharts {...props} />;
}
export function TrendChartLazy(props: ComponentProps<typeof TrendChart>) {
  return <TrendChart {...props} />;
}
export function RecentMovementsLazy(props: ComponentProps<typeof RecentMovements>) {
  return <RecentMovements {...props} />;
}
export function MovementsChartLazy(props: ComponentProps<typeof MovementsChart>) {
  return <MovementsChart {...props} />;
}
export function LossBreakdownChartLazy(props: ComponentProps<typeof LossBreakdownChart>) {
  return <LossBreakdownChart {...props} />;
}
