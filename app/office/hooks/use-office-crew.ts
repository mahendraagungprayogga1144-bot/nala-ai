"use client";

import { useMemo } from "react";
import { loadOfficeSnapshot } from "@/lib/office/service";

export function useOfficeCrew(businessId: string) {
  return useMemo(() => loadOfficeSnapshot(businessId), [businessId]);
}
