import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformSettings } from "@/lib/admin/settings";
import { isAdminEmail } from "@/lib/auth/admin";
import { getPublicShareOrigin, publicInvoiceUrl } from "@/lib/auth/app-url";
import { buildInvoiceHtml } from "@/lib/payment/invoice";
import { buildInvoiceShareWaMessage } from "@/lib/payment/config";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public printable invoice. Payment UUID acts as an unguessable share token so
 * WhatsApp / email recipients can open the link without a session cookie.
 * Auth is intentionally not required — see proxy.ts needsAuth (excludes /invoice).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return new NextResponse("Invoice tidak ditemukan", { status: 404 });
  }

  const settings = await getPlatformSettings();
  const adminClient = createAdminClient();

  // Public reads must use service role: payments RLS is owner-only (no anon SELECT).
  if (adminClient) {
    const { data: payment, error } = await adminClient
      .from("payments")
      .select(
        "id, user_id, plan, amount, method, status, invoice_id, created_at, confirmed_at, period_start, period_end",
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !payment) {
      return new NextResponse("Invoice tidak ditemukan", { status: 404 });
    }

    const [{ data: profile }, { data: authUser }] = await Promise.all([
      adminClient.from("profiles").select("full_name").eq("id", payment.user_id).maybeSingle(),
      adminClient.auth.admin.getUserById(payment.user_id),
    ]);
    const customerEmail = authUser.user?.email || "";
    const customerName =
      profile?.full_name || customerEmail.split("@")[0] || "Pelanggan";

    return renderInvoice({
      payment,
      customerName,
      customerEmail,
      settings,
    });
  }

  // Local/dev fallback when service role is missing: owner/admin session only.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.redirect(new URL("/login", _req.url));
  }

  const { data: payment, error } = await supabase
    .from("payments")
    .select(
      "id, user_id, plan, amount, method, status, invoice_id, created_at, confirmed_at, period_start, period_end",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !payment) {
    return new NextResponse("Invoice tidak ditemukan", { status: 404 });
  }

  const admin = isAdminEmail(user.email, settings.admin_emails);
  if (!admin && payment.user_id !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let customerName = user.email.split("@")[0] || "Pelanggan";
  const customerEmail = user.email || "";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.full_name) customerName = profile.full_name;

  return renderInvoice({
    payment,
    customerName,
    customerEmail,
    settings,
  });
}

function renderInvoice(opts: {
  payment: {
    id: string;
    plan: string;
    amount: number | string;
    method: string | null;
    status: string;
    invoice_id: string | null;
    created_at: string;
    confirmed_at: string | null;
    period_start: string | null;
    period_end: string | null;
  };
  customerName: string;
  customerEmail: string;
  settings: Awaited<ReturnType<typeof getPlatformSettings>>;
}) {
  const { payment, customerName, customerEmail, settings } = opts;
  const invoiceId = payment.invoice_id || payment.id.slice(0, 8).toUpperCase();
  const appUrl = getPublicShareOrigin(settings.app_url);
  const invoiceUrl = publicInvoiceUrl(payment.id, settings.app_url);
  const waShareUrl = buildInvoiceShareWaMessage({
    name: customerName,
    email: customerEmail || "—",
    plan: payment.plan,
    amount: Number(payment.amount),
    invoice: invoiceId,
    status: payment.status,
    invoiceUrl,
    wa: settings.payment_wa,
  });

  const html = buildInvoiceHtml({
    invoiceId,
    status: payment.status,
    plan: payment.plan,
    amount: Number(payment.amount),
    method: payment.method,
    createdAt: payment.created_at,
    confirmedAt: payment.confirmed_at,
    periodStart: payment.period_start,
    periodEnd: payment.period_end,
    customerName,
    customerEmail: customerEmail || "—",
    bankAccounts: settings.bank_accounts,
    qrisImageUrl: settings.qris_image_url || undefined,
    companyName: "Gercep AI",
    supportEmail: settings.support_email,
    appUrl,
    waShareUrl,
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      // Helpful for WA in-app browser / link unfurlers
      "X-Robots-Tag": "noindex",
    },
  });
}
