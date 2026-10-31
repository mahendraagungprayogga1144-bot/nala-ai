/**
 * GPS untuk link sales: di browser pakai Geolocation API,
 * di app Capacitor (Android/iOS) pakai plugin native + background watcher.
 */

export type GeoFix = { lat: number; lng: number; acc: number };

type WatchHandle = { stop: () => void };

function browserFix(pos: GeolocationPosition): GeoFix {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    acc: Math.round(pos.coords.accuracy),
  };
}

export async function isNativeApp() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function readNativeOrBrowserGps(): Promise<GeoFix> {
  if (await isNativeApp()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 3000,
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
    try {
      // Plugin community — lebih tahan saat app di belakang / layar mati (Android).
      const { registerPlugin } = await import("@capacitor/core");
      type BgGeo = {
        addWatcher: (
          options: Record<string, unknown>,
          cb: (location?: { latitude: number; longitude: number; accuracy?: number }, error?: Error) => void,
        ) => Promise<string>;
        removeWatcher: (options: { id: string }) => Promise<void>;
      };
      const BackgroundGeolocation = registerPlugin<BgGeo>("BackgroundGeolocation");
      const id = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "Henima sedang melacak lokasi sales. Berhenti setelah check-out.",
          backgroundTitle: "Henima · auto track aktif",
          requestPermissions: true,
          stale: false,
          distanceFilter: 25,
        },
        (location, error) => {
          if (error) {
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
        { enableHighAccuracy: true, timeout: 25000 },
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
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 25000 },
  );
  const heartbeat = window.setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => onFix(browserFix(pos)),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
  }, 55_000);

  return {
    stop: () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(heartbeat);
    },
  };
}
