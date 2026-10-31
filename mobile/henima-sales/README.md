# Henima Sales (Android app)

App Capacitor untuk sales lapangan. Membuka `https://gercepos.id` di WebView dan memakai **GPS native + background geolocation**, jadi auto track lebih kuat saat keluar ke WhatsApp/Maps (bukan cuma tab Chrome).

## Syarat

- Node 20+
- Android Studio (SDK + emulator atau HP USB debugging)
- JDK 17

## Setup sekali

```bash
cd mobile/henima-sales
npm install
npm run build:web
npx cap add android
npx cap sync android
```

Di Android Studio, pastikan permission lokasi di `AndroidManifest.xml` sudah ada (Capacitor Geolocation + Background Geolocation biasanya menambah otomatis saat sync):

- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION` (Android 10+)
- `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_LOCATION`

## Jalankan

```bash
npm run sync
npm run open
```

### Pasang ke HP (USB)

1. Di HP: **Settings → About phone** → ketuk **Build number** 7× → aktifkan **Developer options**.
2. Nyalakan **USB debugging** (+ **Install via USB** kalau ada).
3. Colok kabel ke Mac/PC → di HP muncul popup **Allow USB debugging?** → **Allow**.
4. Di Android Studio, dropdown device harus muncul nama HP-mu (bukan cuma emulator).
5. Klik **Run ▶** (hijau).

Kalau HP tidak muncul: ganti kabel (harus data, bukan charge-only), coba port USB lain, atau di notifikasi USB HP pilih **File transfer / MTP**.

### APK dikirim ke HP (tanpa Run / tanpa USB debugging)

Kalau Run gagal, buat file APK lalu kirim WhatsApp/Drive:

1. Android Studio → **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
2. Tunggu selesai → klik **locate** / buka folder:
   `android/app/build/outputs/apk/debug/app-debug.apk`
3. Kirim `app-debug.apk` ke HP.
4. Di HP: buka file → izinkan **Install unknown apps** untuk Chrome/Files/WhatsApp → **Install**.

> Catatan: ini APK debug (untuk uji sendiri). Bukan dari Play Store.

## Alur sales

1. Founder salin link HP (`/t/{token}`) dari dashboard Henima Tracking.
2. Sales buka link itu **di dalam app Henima Sales** (paste di Chrome in-app / buka dari notifikasi).
3. Check-in pagi sekali → auto track GPS native sampai check-out.

## URL custom (staging)

```bash
HENIMA_MOBILE_URL=https://preview-xxx.vercel.app npm run sync
```

## Catatan

- iOS bisa ditambah nanti (`npx cap add ios`) — background GPS iOS lebih ketat (perlu Always permission + review App Store).
- Build APK release: Android Studio → Build → Generate Signed Bundle / APK.
