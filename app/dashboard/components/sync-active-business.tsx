"use client";

import { useEffect, useRef } from "react";
import { syncActiveBusinessCookie } from "@/app/actions/business";

/** Sync active_business_id via Server Action (safe — never set cookies in RSC). */
export default function SyncActiveBusiness({ businessId }: { businessId?: string | null }) {
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!businessId || businessId === last.current) return;
    last.current = businessId;
    const m = document.cookie.match(/(?:^|; )active_business_id=([^;]*)/);
    const current = m ? decodeURIComponent(m[1]) : "";
    if (current === businessId) return;
    void syncActiveBusinessCookie(businessId);
  }, [businessId]);

  return null;
}
