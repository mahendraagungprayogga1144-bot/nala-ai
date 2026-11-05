export const MENTOR_PERMISSIONS = {
  READ: true,
  ANALYZE: true,
  WRITE: false,
  FINANCIAL_TRANSACTION: false,
  EXTERNAL_MESSAGE: false,
} as const;

export type MentorPermission = keyof typeof MENTOR_PERMISSIONS;

export function assertAnalyzeOnly() {
  if (MENTOR_PERMISSIONS.WRITE) {
    throw new Error("Phase 3 must keep WRITE disabled.");
  }
}

export const PERMISSION_SYSTEM_NOTE = `
PERMISSIONS (Phase 3 — wajib dipatuhi):
- READ: boleh membaca Business Memory yang diberikan.
- ANALYZE: boleh menganalisis dan merekomendasikan.
- WRITE: DILARANG mengubah data bisnis, angka keuangan, atau memory.
- FINANCIAL_TRANSACTION: DILARANG.
- EXTERNAL_MESSAGE: DILARANG mengirim pesan eksternal.
Jika owner meminta aksi write/transaksi, jelaskan bahwa Phase 3 hanya analisis dan minta persetujuan/aksi manual.
`.trim();
