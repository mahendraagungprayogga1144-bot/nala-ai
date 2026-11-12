import { after } from "next/server";
import { withSalesActor } from "@/lib/henima-sales/http";
import { createClient } from "@/lib/supabase/server";
import { loadVisiblePoints } from "@/lib/henima-tracking/service";
import { ownerBotConfigured } from "@/lib/henima-tracking/owner-bot";
import { watchSilentForBusiness } from "@/lib/henima-tracking/silent-watch";
import { salesDb } from "@/lib/henima-sales/db";
import { todayWib } from "@/lib/date";

export const runtime = "nodejs";

function chosenDay(raw: string | null) {
  const today = todayWib();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw > today) return today;
  return raw;
}

export async function GET(request: Request) {
  return withSalesActor(async ({ actor }) => {
    const url = new URL(request.url);
    const day = chosenDay(url.searchParams.get("hari"));
    const light = url.searchParams.get("light") === "1";
    const session = await createClient();
    const visible = await loadVisiblePoints(session, day, { skipPhotos: light });

    // Saat Command Center dibuka: HRD sweep lagi biar tidak kecolongan.
    if (ownerBotConfigured() && (actor.role === "FOUNDER" || actor.role === "LEADER")) {
      const businessId = actor.businessId;
      after(async () => {
        try {
          await watchSilentForBusiness(salesDb(), businessId);
        } catch {
          /* ignore */
        }
      });
    }

    return {
      date: visible.date,
      today: todayWib(),
      points: visible.points,
    };
  });
}
