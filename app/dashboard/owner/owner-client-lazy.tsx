"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const DashboardOwnerClient = dynamic(() => import("./dashboard-owner-client"), {
  ssr: false,
  loading: () => (
    <div className="px-4 py-8 sm:px-8">
      <div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
    </div>
  ),
});

export default function OwnerClientLazy(
  props: ComponentProps<typeof DashboardOwnerClient>,
) {
  return <DashboardOwnerClient {...props} />;
}
