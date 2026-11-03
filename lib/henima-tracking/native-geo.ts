/**
 * GPS untuk link sales: di browser pakai Geolocation API,
 * di app Capacitor (Android/iOS) pakai plugin native + background watcher.
 */

export type GeoFix = { lat: number; lng: number; acc: number };

export type NativeLocationPermission = {
  ok: boolean;
  /** true kalau foreground location granted (fine/coarse). */
  foreground: boolean;
  message: string;
};

type WatchHandle = { stop: () => void };

type BgGeo = {
  addWatcher: (
    options: Record<string, unknown>,
    cb: (location?: { latitude: number; longitude: number; accuracy?: number; time?: number }, error?: { code?: string; message?: string }) => void,
  ) => Promise<string>;
  removeWatcher: (options: { id: string }) => Promise<void>;
  openSettings: () => Promise<void>;
};

function browserFix(pos: GeolocationPosition): GeoFix {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    acc: Math.round(pos.coords.accuracy),
  };
}

async function backgroundGeo(): Promise<BgGeo> {
  const { registerPlugin } = await import("@capacitor/core");
  return registerPlugin<BgGeo>("BackgroundGeolocation");
}

export async function isNativeApp() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Buka pengaturan lokasi app — user pilih "Izinkan selalu / Allow all the time". */
export async function openNativeLocationSettings() {
  if (!(await isNativeApp())) return;
  try {
    const bg = await backgroundGeo();
    await bg.openSettings();
  } catch {
    /* ignore */
  }
}

/**
 * Minta izin lokasi di app. Untuk tracking belakang, Android perlu
 * "Izinkan selalu" — setelah grant foreground, arahkan user ke settings.
 */
export async function ensureNativeLocationPermissions(): Promise<NativeLocationPermission> {
  if (!(await isNativeApp())) {
    return { ok: true, foreground: true, message: "" };
  }

  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    let status = await Geolocation.checkPermissions();
    if (status.location !== "granted" && status.coarseLocation !== "granted") {
      status = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
    }
    const foreground = status.location === "granted" || status.coarseLocation === "granted";
    if (!foreground) {
      return {
        ok: false,
        foreground: false,
        message: 'Lokasi ditolak. Di pengaturan HP pilih "Izinkan selalu" untuk Henima Sales.',
      };
    }
    return {
      ok: true,
      foreground: true,
      message:
        'Untuk GPS jalan terus di belakang: buka pengaturan lokasi app → pilih "Izinkan selalu" / Allow all the time.',
    };
  } catch {
    return {
      ok: false,
      foreground: false,
      message: "Gagal meminta izin lokasi. Buka pengaturan HP.",
    };
  }
}

export async function readNativeOrBrowserGps(): Promise<GeoFix> {
  if (await isNativeApp()) {
    await ensureNativeLocationPermissions();
    const { Geolocation } = await import("@capacitor/geolocation");
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 25000,
      maximumAge: 0,
    });
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      acc: Math.round(pos.coords.accuracy ?? 50),
    };
  }
  if (!navigator.geolocation) throw new Error("GPS tidak tersedia.");
  return await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(browserFix(pos)),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

/**
 * Pantau lokasi terus. Di app native: watcher background (notif foreground service).
 * Di Chrome: watchPosition + heartbeat pemanggil.
 */
export async function watchNativeOrBrowserGps(
  onFix: (fix: GeoFix) => void,
  onError?: (message: string) => void,
): Promise<WatchHandle> {
  if (await isNativeApp()) {
    const perm = await ensureNativeLocationPermissions();
    if (!perm.ok) {
      onError?.(perm.message);
    }

    try {
      const BackgroundGeolocation = await backgroundGeo();
      const id = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage:
            "GPS live ke owner. Jangan force-stop. Izin lokasi harus Izinkan selalu.",
          backgroundTitle: "Henima · GPS live",
          requestPermissions: true,
          stale: false,
          // Update lebih rapat agar titik akurat saat bergerak.
          distanceFilter: 5,
        },
        (location, error) => {
          if (error) {
            if (error.code === "NOT_AUTHORIZED") {
              onError?.(
                'Izin lokasi kurang. Tap "Buka pengaturan lokasi" lalu pilih Izinkan selalu.',
              );
              return;
            }
            onError?.(error.message || "GPS native gagal.");
            return;
          }
          if (!location) return;
          onFix({
            lat: location.latitude,
            lng: location.longitude,
            acc: Math.round(location.accuracy ?? 50),
          });
        },
      );
      return {
        stop: () => {
          void BackgroundGeolocation.removeWatcher({ id });
        },
      };
    } catch {
      // Fallback Geolocation Capacitor (tanpa background service).
      const { Geolocation } = await import("@capacitor/geolocation");
      const id = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
        (pos, err) => {
          if (err || !pos) {
            onError?.(err?.message || "GPS gagal.");
            return;
          }
          onFix({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            acc: Math.round(pos.coords.accuracy ?? 50),
          });
        },
      );
      return {
        stop: () => {
          void Geolocation.clearWatch({ id });
        },
      };
    }
  }

  if (!navigator.geolocation) {
    onError?.("GPS tidak tersedia.");
    return { stop: () => undefined };
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => onFix(browserFix(pos)),
    (err) => onError?.(err.message || "GPS gagal."),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
  );
  const heartbeat = window.setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => onFix(browserFix(pos)),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );
  }, 15_000);

  return {
    stop: () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(heartbeat);
    },
  };
}
