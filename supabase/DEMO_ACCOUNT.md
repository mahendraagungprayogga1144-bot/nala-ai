# Akun Demo Gercep AI — dinonaktifkan

Login/daftar demo (**Masuk Akun Demo**, `demo@gercep.id` shared) sudah **dihapus dari produk** (commit `1db5a07`).

Pembeli hanya bisa daftar/masuk dengan akun pribadi (email/password). Onboarding membuat bisnis kosong milik user — **tidak** lagi seed "Warung Pak Budi" / sample data.

Bisnis contoh lama (hanya milik `demo@gercep.id`):

- Warung Pak Budi (kuliner)
- Kebun Sejahtera (pertanian)
- Ternak Makmur (ternak)

## Diagnostik: customer mendarat di "Warung Pak Budi"

Jalankan di Supabase SQL Editor (ganti email jika perlu):

```sql
-- 1) Auth user(s) untuk email customer (dan alias %)
SELECT id, email, created_at, last_sign_in_at, email_confirmed_at
FROM auth.users
WHERE lower(email) LIKE 'alfiannyco2001%'
   OR lower(email) = 'alfiannyco2001@gmail.com'
ORDER BY created_at;

-- 2) Bandingkan dengan akun demo shared
SELECT id AS demo_user_id, email, created_at
FROM auth.users
WHERE lower(email) = 'demo@gercep.id';

-- 3) Apakah customer = demo user? (harusnya tidak)
SELECT
  c.id AS customer_id,
  c.email AS customer_email,
  d.id AS demo_id,
  (c.id = d.id) AS same_user_as_demo
FROM auth.users c
CROSS JOIN LATERAL (
  SELECT id FROM auth.users WHERE lower(email) = 'demo@gercep.id' LIMIT 1
) d
WHERE lower(c.email) LIKE 'alfiannyco2001%';

-- 4) Bisnis yang dimiliki customer
SELECT b.id, b.name, b.type, b.user_id, b.created_at, u.email AS owner_email
FROM public.businesses b
JOIN auth.users u ON u.id = b.user_id
WHERE lower(u.email) LIKE 'alfiannyco2001%'
ORDER BY b.created_at;

-- 5) Membership / invite (jika tabel ada)
SELECT m.*
FROM public.business_members m
WHERE lower(m.member_email) LIKE 'alfiannyco2001%'
   OR m.member_user_id IN (
        SELECT id FROM auth.users WHERE lower(email) LIKE 'alfiannyco2001%'
      );

-- 6) Siapa pemilik "Warung Pak Budi" di DB?
SELECT b.id, b.name, b.type, b.user_id, u.email AS owner_email, b.created_at
FROM public.businesses b
JOIN auth.users u ON u.id = b.user_id
WHERE b.name ILIKE '%Warung Pak Budi%'
   OR b.name ILIKE '%Kebun Sejahtera%'
   OR b.name ILIKE '%Ternak Makmur%';
```

### Interpretasi cepat

| Hasil | Artinya |
| --- | --- |
| Customer `id` = `demo@gercep.id` `id` | Mereka login sebagai akun demo shared (bukan akun pribadi). |
| Customer punya bisnis sendiri bernama Warung Pak Budi | Mereka ketik nama itu di onboarding (placeholder lama), atau rename. Bukan shared tenant. |
| Membership ke bisnis milik `demo@gercep.id` | Diundang / ter-attach ke demo — unlink membership. |
| Cookie saja | Tidak bisa menampilkan bisnis orang lain: app hanya load `businesses.user_id = auth.uid()`. |

## Perbaikan aman untuk 1 customer (jangan wipe semua demo)

Ganti `:customer_id` dari query (1). Pilih skenario yang cocok.

### A) Customer punya membership ke bisnis demo — lepaskan saja

```sql
-- Preview
SELECT * FROM public.business_members
WHERE member_user_id = ':customer_id'
   OR lower(member_email) LIKE 'alfiannyco2001%';

-- Unlink
DELETE FROM public.business_members
WHERE member_user_id = ':customer_id'
   OR lower(member_email) LIKE 'alfiannyco2001%';
```

Lalu minta customer logout → login ulang → `/onboarding?mode=new` buat bisnis sendiri.

### B) Customer **memiliki** bisnis bernama sample (bukan milik demo) — hapus bisnis itu saja

Hanya hapus baris bisnis milik customer ini (cascade produk/tx tergantung FK). Preview dulu:

```sql
SELECT id, name, type, user_id, created_at
FROM public.businesses
WHERE user_id = ':customer_id'
  AND (
    name ILIKE '%Warung Pak Budi%'
    OR name ILIKE '%Kebun Sejahtera%'
    OR name ILIKE '%Ternak Makmur%'
  );
```

Jika OK dan tidak ada data penting:

```sql
DELETE FROM public.businesses
WHERE user_id = ':customer_id'
  AND (
    name ILIKE '%Warung Pak Budi%'
    OR name ILIKE '%Kebun Sejahtera%'
    OR name ILIKE '%Ternak Makmur%'
  );
```

Atau rename tanpa hapus data:

```sql
UPDATE public.businesses
SET name = 'Bisnis Saya'
WHERE user_id = ':customer_id'
  AND name ILIKE '%Warung Pak Budi%';
```

Setelah kosong, customer buka `/onboarding?mode=new`.

### C) Mereka hanya pakai demo shared — buat akun asli

Jangan hapus `demo@gercep.id` kecuali memang mau matikan demo di DB. Suruh daftar ulang dengan `alfiannyco2001@gmail.com` (kalau belum ada) atau login akun pribadi lalu onboarding.

## Bersihkan akun demo di Supabase (opsional, manual)

Produk **tidak** menghapus user demo otomatis. Jika ingin membersihkan:

1. Auth → Users → cari `demo@gercep.id` → Delete user (cascade data terkait jika perlu).
2. (Opsional) hapus setting key `demo_enabled` di tabel platform settings — tidak dipakai lagi oleh app.

Jangan jalankan wipe massal dari aplikasi.
