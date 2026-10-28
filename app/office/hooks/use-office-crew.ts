"use client";

import { useState } from "react";
import type { OfficeSnapshot } from "@/lib/office/types";

export function useOfficeCrew(initial: OfficeSnapshot) {
  const [snapshot, setSnapshot] = useState(initial);
  return { snapshot, setSnapshot };
}
