import type { AutonomyLevel } from "./types";

/**
 * Hard safety policy for Phase 7.
 * Tools outside the registry are never callable.
 */
export const AUTONOMY_HARD_DENY = [
  "money_transfer",
  "payment_account_change",
  "salary_set",
  "financial_commitment",
  "raw_sql",
  "shell_exec",
  "filesystem_write",
  "arbitrary_code",
  "permission_escalate",
  "delete_critical_data",
] as const;

export function levelAllowsTool(ownerLevel: AutonomyLevel, toolLevel: AutonomyLevel): boolean {
  return ownerLevel >= toolLevel;
}

export function policyNote(level: AutonomyLevel): string {
  if (level === 0) {
    return "Level 0: hanya baca & analisis. Tidak menulis memori atau mengirim pesan.";
  }
  if (level === 1) {
    return "Level 1: boleh menyiapkan draft/rencana. Tidak mengeksekusi dampak eksternal.";
  }
  if (level === 2) {
    return "Level 2: tindakan berdampak butuh Approval Center (satu aksi = satu approval).";
  }
  return "Level 3: otonomi terbatas hanya untuk tools yang ada di allowlist owner. Tidak boleh self-escalate.";
}

export const FORBIDDEN_CLAIMS = `
Jangan klaim transfer uang, ubah rekening, tetapkan gaji, kirim WA pelanggan,
atau hapus data penting. Jika tidak yakin — hentikan dan minta keputusan owner.
`.trim();
