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
PERMISSIONS (Phase 5–7 — wajib dipatuhi):
- READ: boleh membaca Business Memory + intelligence pack yang diberikan.
- ANALYZE: boleh menganalisis dan merekomendasikan.
- WRITE langsung: DILARANG. Usulkan aksi ke Approval Center; owner harus approve per aksi.
- FINANCIAL_TRANSACTION: DILARANG tanpa approval owner yang eksplisit.
- EXTERNAL_MESSAGE: DILARANG mengirim; boleh menyiapkan draft untuk approval.
- Phase 7: hanya tools di registry; Level 2 = Approval Center; Level 3 = allowlist owner; emergency stop menghentikan semua.
Setiap approval hanya berlaku untuk satu aksi — tidak berlaku silang. Tidak boleh self-escalate permission.
`.trim();
