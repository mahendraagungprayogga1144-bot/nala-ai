import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/admin/settings";
import { isAdminEmail } from "@/lib/auth/admin";
import { buildInvoiceHtml } from "@/lib/payment/invoice";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.redirect(new URL("/login", _req.url));
  }

  const settings = await getPlatformSettings();
  const admin = isAdminEmail(user.email, settings.admin_emails);
  const adminClient = createAdminClient();
  const db = admin && adminClient ? adminClient : supabase;

  const { data: payment, error } = await db
    .from("payments")
    .select(
      "id, user_id, plan, amount, method, status, invoice_id, created_at, confirmed_at, period_start, period_end",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !payment) {
    return new NextResponse("Invoice tidak ditemukan", { status: 404 });
  }

  if (!admin && payment.user_id !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let customerName = user.email.split("@")[0] || "User";
  let customerEmail = user.email;
  if (adminClient) {
    const [{ data: profile }, { data: authUser }] = await Promise.all([
      adminClient.from("profiles").select("full_name").eq("id", payment.user_id).maybeSingle(),
      adminClient.auth.admin.getUserById(payment.user_id),
    ]);
    customerEmail = authUser.user?.email || customerEmail;
    customerName = profile?.full_name || customerEmail.split("@")[0] || customerName;
  } else if (payment.user_id === user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.full_name) customerName = profile.full_name;
  }

  const html = buildInvoiceHtml({
    invoiceId: payment.invoice_id || payment.id.slice(0, 8).toUpperCase(),
    status: payment.status,
    plan: payment.plan,
    amount: Number(payment.amount),
    method: payment.method,
    createdAt: payment.created_at,
    confirmedAt: payment.confirmed_at,
    periodStart: payment.period_start,
    periodEnd: payment.period_end,
    customerName,
    customerEmail,
    bankAccounts: settings.bank_accounts,
    companyName: "Gercep AI",
    supportEmail: settings.support_email,
    appUrl: settings.app_url,
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
