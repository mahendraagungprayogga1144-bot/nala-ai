-- Pajak NPWP Center — profil NPWP + riwayat bayar pajak

CREATE TABLE IF NOT EXISTS npwp_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE UNIQUE,
  npwp TEXT,
  nama_wp TEXT,
  alamat TEXT,
  jenis_usaha TEXT,
  klu TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pajak_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  tahun INT NOT NULL,
  bulan INT NOT NULL,
  omzet_bulan NUMERIC DEFAULT 0,
  pph_terutang NUMERIC DEFAULT 0,
  pph_dibayar NUMERIC DEFAULT 0,
  tanggal_bayar DATE,
  no_ntpn TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_npwp_user ON npwp_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_pajak_user ON pajak_records(user_id);
CREATE INDEX IF NOT EXISTS idx_pajak_tahun ON pajak_records(tahun, bulan);

ALTER TABLE npwp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pajak_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "npwp_own" ON npwp_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "pajak_own" ON pajak_records FOR ALL USING (auth.uid() = user_id);
