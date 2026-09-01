# Gercep Ops Runbook (startup)

Singkat. Untuk tim admin Gercep di production (`https://www.gercepos.id`).

## Akses Admin

1. Login dengan email yang ada di **Settings → Admin emails**.
2. Buka `/admin`.
3. Role:
   - **owner** — full Settings + purge + ACC
   - **support** — ACC payment, Users, Activity; tidak bisa Settings

## ACC pembayaran

1. `/admin/payments` → filter **pending**.
2. Cek transfer user (WA / rekening).
3. Klik **ACC** → langganan +30 hari aktif, invoice terbuka (Print → Save as PDF).
4. Kalau pending &gt; 6 jam: badge di Overview/Health → **Reminder WA tim**.

## Maintenance

1. `/admin/settings` (owner) → **Maintenance mode ON** + isi pesan.
2. User non-admin diarahkan ke `/maintenance`.
3. Admin tetap bisa masuk `/admin` dan dashboard.

## Tambah admin

1. Owner → Settings → tambah email di **Admin emails**.
2. Set role **owner** atau **support**.
3. Simpan. User harus punya akun Auth Supabase (signup / invite).

## Staging vs Production

- **Production** deploy dari branch `main` → `www.gercepos.id`.
- **Preview/Staging**: push branch lain; Vercel Preview URL untuk uji (jangan uji eksperimen langsung di `main`).
- Setelah fitur siap: merge / FF ke `main`.

## Checklist eksternal (bukan dari Admin UI)

Lihat `/admin/health`:

- Supabase **Site URL** + Redirect URLs = `https://www.gercepos.id`
- Supabase **SMTP** (email reset password)
- Vercel env `NEXT_PUBLIC_APP_URL` = `https://www.gercepos.id`
- Supabase **Backups** on (Dashboard → Project Settings → Database)
- Service role key hanya di Vercel env / password manager — jangan di chat
- Henima Studio: `PHOTOROOM_API_KEY` (ganti latar) dan `GEMINI_API_KEY` (tukar botol @img1 scene + @img2 botol, seperti Nano Banana). Key Gemini: [Google AI Studio](https://aistudio.google.com/apikey). Setelah itu jalankan migration `supabase/migrations/20260901_henima_studio.sql`.

## Invoice user

User: `/dashboard/upgrade` → **Unduh invoice terakhir** (atau link saat pending).  
Admin: link **Invoice** di baris payment paid.

## Purge events

Owner → Settings → **Purge events lama** (hormati `event_retention_days`).
