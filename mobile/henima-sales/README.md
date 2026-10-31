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

Lalu di Android Studio: **Run ▶** ke HP/emulator.

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
