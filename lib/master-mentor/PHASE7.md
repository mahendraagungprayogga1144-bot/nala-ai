# HENIMA AI Phase 7 — Bounded Autonomous Business Assistant

## 1. Audit Phase 1–6 (sebelum implementasi)

| Area | Status | Catatan |
|------|--------|---------|
| Phase 1 Portfolio | **OK** | `module_master_mentor_businesses`, owner gate |
| Phase 2 Memory | **OK** | Owner/business/financial/decision/strategy/learning + candidates |
| Phase 3 Mentor Chat | **OK** | Orchestrator + specialists; analyze-only |
| Phase 4 Intelligence | **OK** | Facts dari Gercep; butuh `gercep_business_id` |
| Phase 5 Approvals | **OK** | Actions + executions; satu approval ≠ blanket |
| Phase 6 Automation | **OK** | Cron harian (Hobby), WA draft, Shopee stub |
| Authz | **OK** | `requireMentorOwnerPage` / `withMentorOwner` |
| Audit log | **OK** | `module_master_mentor_audit_logs` |

**Gap yang tidak menghalangi Phase 7 (dilaporkan, tidak dibypass):**
- Shopee Open Platform belum ada credentials → tidak dipakai sebagai tool eksekusi.
- WA pelanggan tidak auto-send (hanya draft + approval) — sesuai kebijakan.
- Financial Memory / seed masih bergantung owner mengisi atau tombol seed.
- Auto-deploy Git Vercel sempat macet; Deploy Hook dipakai sebagai cadangan.

**Keputusan arsitektur:** tidak memakai framework agen baru (eve). Phase 7 dibangun di `lib/master-mentor/autonomy/*` agar selaras Gercep OS + Phase 5 Approval Center.

## 2. Fitur yang dibuat

- Autonomy levels 0–3 + emergency stop
- Deterministic Task Planner (hanya tool registry)
- Execution state machine + verifikasi sebelum `completed`
- Tool registry (builtin read / prepare / approval / level-3 allowlist)
- Bridge Level 2 → Phase 5 Approval Center
- UI: Autonomous Assistant, Task Planner, Execution Monitor, Permission Settings, Tool Registry
- Monitor: active / pending approval / completed / failed / avg time / tool runs

## 3. Database

Migration: `supabase/migrations/20261106_master_mentor_phase7_autonomy.sql`

Tables:
- `module_master_mentor_autonomy_settings`
- `module_master_mentor_auto_tasks`
- `module_master_mentor_auto_steps`
- `module_master_mentor_tool_runs`
- `module_master_mentor_emergency_stops`

**Owner harus menjalankan SQL ini di Supabase sebelum UI dipakai.**

## 4. Tools terdaftar

| Tool | Level | Approval |
|------|-------|----------|
| `memory.retrieve` | 0 | no |
| `intelligence.pack` | 0 | no |
| `finance.snapshot` | 0 | no |
| `portfolio.list` | 0 | no |
| `report.prepare_briefing` | 1 | no |
| `action.propose_recommendation` | 1 | no (creates pending action) |
| `action.propose_decision` | 1 | no (memory candidate) |
| `external.message_draft` | 2 | **yes** |
| `financial.memory_write_propose` | 2 | **yes** |
| `report.run_internal_summary` | 3 | allowlist |
| `reminder.create_internal` | 3 | allowlist |
| `data.check_scheduled_health` | 3 | allowlist |

Tidak ada: shell, raw SQL, filesystem, transfer uang, ubah rekening, set gaji.

## 5. Permission aktif

- Default `autonomy_level = 0`
- Default `emergency_stop = false` (bisa diaktifkan owner)
- Level 3 tools kosong sampai diisi allowlist
- Chat Mentor tetap analyze-only (`MENTOR_PERMISSIONS.WRITE = false`)

## 6. Testing

`npm run test:master-mentor` — state machine, planner level caps, registry idempotent, unauthorized tool null.

## 7. Belum terhubung API eksternal

- Shopee sync (stub Phase 6)
- WA Infobip send pelanggan (draft only)
- LLM planner bebas (sengaja diganti deterministic planner agar tidak invent tool)

## 8. Risiko tersisa

- Tanpa migration Phase 7, API mengembalikan notice missing table.
- Level 1 `propose_recommendation` membuat pending actions — bisa spam jika goal diulang (mitigasi: idempotency key harian).
- Production autonomous Level 3 **jangan dinyalakan** sebelum owner menguji Level 0–2.

## 9. Cara owner menguji

1. Jalankan migration Phase 7 di Supabase.
2. Deploy app.
3. Buka **Autonomous Assistant**.
4. Permission Settings → pastikan level **0** atau **1**.
5. Masukkan goal contoh penjualan → **Rencana + jalankan**.
6. Cek Execution Monitor + langkah task.
7. Naikkan ke level **2** → goal berisi “kirim WA” → pastikan masuk Approval Center, **tidak terkirim**.
8. Uji **Emergency Stop**.

**Jangan aktifkan Level 3 di production sebelum approval workflow lolos uji.**
