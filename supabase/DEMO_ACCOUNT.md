# Akun Demo Gercep AI — dinonaktifkan

Login/daftar demo (**Masuk Akun Demo**, `demo@gercep.id` shared) sudah **dihapus dari produk**.

Pembeli hanya bisa daftar/masuk dengan akun pribadi (email/password).

## Data lama di Supabase (opsional, manual)

Produk **tidak** menghapus user demo otomatis. Jika ingin membersihkan di dashboard Supabase:

1. Auth → Users → cari `demo@gercep.id` → Delete user (cascade data terkait jika perlu).
2. (Opsional) hapus setting key `demo_enabled` di tabel platform settings — tidak dipakai lagi oleh app.

Jangan jalankan wipe massal dari aplikasi.
