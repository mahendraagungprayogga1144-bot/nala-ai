import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { getPlatformSettings, isOwnerAdmin, getAdminRole } from "@/lib/admin/settings";
import { NextResponse } from "next/server";

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  const settings = await getPlatformSettings();
  if (!isAdminEmail(user.email, settings.admin_emails)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  const role = getAdminRole(user.email, settings) || "owner";
  return { user, settings, role, admin: createAdminClient() } as const;
}

export async function requireOwner() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;
  if (!isOwnerAdmin(gate.user.email, gate.settings)) {
    return {
      error: NextResponse.json(
        { error: "Hanya owner yang boleh mengubah settings kritis" },
        { status: 403 },
      ),
    } as const;
  }
  return gate;
}
