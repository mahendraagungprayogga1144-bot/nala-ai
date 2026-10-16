import { fmtRp } from "../money";
import { salesLogError } from "../log";

export type KommoLead = { id: number; name: string; price: number };

export function kommoConfigured() {
  return Boolean(process.env.KOMMO_TOKEN?.trim() && process.env.KOMMO_SUBDOMAIN?.trim());
}

export function formatKommoLeads(leads: KommoLead[]) {
  if (!leads.length) return "Belum ada lead di Kommo.";
  return ["LEAD KOMMO", ...leads.slice(0, 8).map((lead) => `${lead.id} · ${lead.name} · ${fmtRp(lead.price)}`)].join("\n");
}

export async function listKommoLeads(limit = 8) {
  const token = process.env.KOMMO_TOKEN?.trim();
  const subdomain = process.env.KOMMO_SUBDOMAIN?.trim();
  if (!token || !subdomain) return "Kommo belum diatur. Isi KOMMO_TOKEN dan KOMMO_SUBDOMAIN di Vercel.";
  try {
    const res = await fetch(`https://${subdomain}.kommo.com/api/v4/leads?limit=${limit}&order[updated_at]=desc`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (res.status === 204) return formatKommoLeads([]);
    if (!res.ok) {
      salesLogError("kommo_leads", { status: res.status }, { status: res.status });
      return "Kommo menolak permintaan. Cek token di Vercel, lalu redeploy.";
    }
    const body = (await res.json()) as { _embedded?: { leads?: { id?: number; name?: string; price?: number }[] } };
    const leads = (body._embedded?.leads || []).map((lead) => ({
      id: Number(lead.id || 0),
      name: (lead.name || "Tanpa nama").slice(0, 80),
      price: Number(lead.price || 0),
    }));
    return formatKommoLeads(leads);
  } catch (err) {
    salesLogError("kommo_leads", err);
    return "Kommo sedang tidak terjangkau.";
  }
}
