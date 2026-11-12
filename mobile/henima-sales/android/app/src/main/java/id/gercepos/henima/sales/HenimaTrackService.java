package id.gercepos.henima.sales;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * GPS native foreground — tetap kirim titik ke server meski WebView / app di belakang.
 * Auto stop jam 18:00 WIB.
 */
public class HenimaTrackService extends Service implements LocationListener {
  public static final String PREFS = "henima_track";
  public static final String KEY_TOKEN = "token";
  public static final String KEY_API = "api_base";
  public static final String KEY_TRACCAR = "traccar_osmand";
  public static final String KEY_ACTIVE = "active";

  private static final String CHANNEL = "henima_gps_native";
  private static final int NOTIF_ID = 36010;
  /** Update GPS lebih rapat; prioritas chip GPS supaya akurat. */
  private static final long MIN_TIME_MS = 4_000L;
  private static final float MIN_DIST_M = 3f;
  private static final long HEARTBEAT_MS = 10_000L;
  private static final long FORCE_POST_MS = 15_000L;
  /** Titik bergerak: tolak network kasar kalau GPS bagus baru saja. */
  private static final float ACC_GOOD_M = 35f;
  private static final float ACC_MAX_MOVE_M = 120f;
  private static final float ACC_MAX_FORCE_M = 250f;
  private static final String TAG = "HenimaTrack";

  private LocationManager locationManager;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final ExecutorService net = Executors.newSingleThreadExecutor();
  private Location lastPosted;
  private Location lastGpsGood;
  private long lastPostAt = 0L;
  private PowerManager.WakeLock wakeLock;

  private final Runnable heartbeat = new Runnable() {
    @Override
    public void run() {
      if (isPastCloseWib()) {
        stopSelfSafe();
        return;
      }
      try {
        if (locationManager != null) {
          Location gps = safeLast(LocationManager.GPS_PROVIDER);
          Location netLoc = safeLast(LocationManager.NETWORK_PROVIDER);
          Location passive = safeLast(LocationManager.PASSIVE_PROVIDER);
          Location best = pickBetter(pickBetter(gps, netLoc), passive);
          if (best != null) maybePost(best, true);
        }
      } catch (SecurityException ignored) {
      }
      handler.postDelayed(this, HEARTBEAT_MS);
    }
  };

  public static void start(Context ctx, String token, String apiBase) {
    start(ctx, token, apiBase, "");
  }

  public static void start(Context ctx, String token, String apiBase, String traccarOsmAnd) {
    SharedPreferences p = ctx.getSharedPreferences(PREFS, MODE_PRIVATE);
    p.edit()
        .putString(KEY_TOKEN, token)
        .putString(KEY_API, apiBase)
        .putString(KEY_TRACCAR, traccarOsmAnd == null ? "" : traccarOsmAnd.trim())
        .putBoolean(KEY_ACTIVE, true)
        .apply();
    Intent i = new Intent(ctx, HenimaTrackService.class);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      ctx.startForegroundService(i);
    } else {
      ctx.startService(i);
    }
    scheduleWatchdog(ctx);
  }

  public static void stop(Context ctx) {
    SharedPreferences p = ctx.getSharedPreferences(PREFS, MODE_PRIVATE);
    p.edit().putBoolean(KEY_ACTIVE, false).apply();
    cancelWatchdog(ctx);
    ctx.stopService(new Intent(ctx, HenimaTrackService.class));
  }

  /** Alarm berkala: kalau service mati karena clear RAM / OEM, nyala lagi. */
  public static void scheduleWatchdog(Context ctx) {
    try {
      AlarmManager am = (AlarmManager) ctx.getSystemService(ALARM_SERVICE);
      if (am == null) return;
      PendingIntent pi = watchdogPending(ctx);
      long interval = 12 * 60 * 1000L;
      long first = SystemClock.elapsedRealtime() + 60_000L;
      am.setInexactRepeating(AlarmManager.ELAPSED_REALTIME_WAKEUP, first, interval, pi);
    } catch (Exception e) {
      Log.w(TAG, "schedule watchdog failed", e);
    }
  }

  /** Restart cepat setelah swipe / task removed. */
  public static void scheduleQuickRestart(Context ctx) {
    try {
      AlarmManager am = (AlarmManager) ctx.getSystemService(ALARM_SERVICE);
      if (am == null) return;
      PendingIntent pi = watchdogPending(ctx);
      long when = SystemClock.elapsedRealtime() + 3_000L;
      if (Build.VERSION.SDK_INT >= 23) {
        am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, when, pi);
      } else {
        am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, when, pi);
      }
    } catch (Exception e) {
      Log.w(TAG, "quick restart failed", e);
    }
  }

  public static void cancelWatchdog(Context ctx) {
    try {
      AlarmManager am = (AlarmManager) ctx.getSystemService(ALARM_SERVICE);
      if (am == null) return;
      am.cancel(watchdogPending(ctx));
    } catch (Exception e) {
      Log.w(TAG, "cancel watchdog failed", e);
    }
  }

  private static PendingIntent watchdogPending(Context ctx) {
    Intent i = new Intent(ctx, HenimaWatchdogReceiver.class);
    i.setAction(HenimaWatchdogReceiver.ACTION_WATCHDOG);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getBroadcast(ctx, 4401, i, flags);
  }

  @Override
  public void onCreate() {
    super.onCreate();
    ensureChannel();
    acquireWakeLock();
    Notification n = buildNotification("GPS live · jejak sales jalan terus");
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
    } else {
      startForeground(NOTIF_ID, n);
    }
    locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
    if (!p.getBoolean(KEY_ACTIVE, false) || p.getString(KEY_TOKEN, "").isEmpty()) {
      stopSelfSafe();
      return START_NOT_STICKY;
    }
    if (isPastCloseWib()) {
      stopSelfSafe();
      return START_NOT_STICKY;
    }
    startListening();
    handler.removeCallbacks(heartbeat);
    handler.post(heartbeat);
    return START_STICKY;
  }

  private void acquireWakeLock() {
    try {
      PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
      if (pm == null) return;
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "henima:gps");
      wakeLock.setReferenceCounted(false);
      if (!wakeLock.isHeld()) wakeLock.acquire(12 * 60 * 60 * 1000L);
    } catch (Exception e) {
      Log.w(TAG, "wake lock failed", e);
    }
  }

  private void releaseWakeLock() {
    try {
      if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    } catch (Exception ignored) {
    }
    wakeLock = null;
  }

  private Location safeLast(String provider) {
    try {
      if (locationManager == null || !locationManager.isProviderEnabled(provider)) return null;
      return locationManager.getLastKnownLocation(provider);
    } catch (SecurityException | IllegalArgumentException e) {
      return null;
    }
  }

  private void startListening() {
    if (locationManager == null) return;
    try {
      locationManager.removeUpdates(this);
    } catch (Exception ignored) {
    }
    try {
      if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
        locationManager.requestLocationUpdates(
            LocationManager.GPS_PROVIDER, MIN_TIME_MS, MIN_DIST_M, this, Looper.getMainLooper());
      }
      if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
        locationManager.requestLocationUpdates(
            LocationManager.NETWORK_PROVIDER, MIN_TIME_MS, MIN_DIST_M, this, Looper.getMainLooper());
      }
      if (locationManager.isProviderEnabled(LocationManager.PASSIVE_PROVIDER)) {
        locationManager.requestLocationUpdates(
            LocationManager.PASSIVE_PROVIDER, MIN_TIME_MS, MIN_DIST_M, this, Looper.getMainLooper());
      }
    } catch (SecurityException e) {
      Log.w(TAG, "location permission missing", e);
      stopSelfSafe();
    }
  }

  @Override
  public void onLocationChanged(Location location) {
    if (isPastCloseWib()) {
      stopSelfSafe();
      return;
    }
    if (location == null || isMockLocation(location)) return;
    if (LocationManager.GPS_PROVIDER.equals(location.getProvider())
        && location.hasAccuracy() && location.getAccuracy() <= ACC_GOOD_M) {
      lastGpsGood = location;
    }
    maybePost(location, false);
  }

  private static boolean isMockLocation(Location location) {
    try {
      if (Build.VERSION.SDK_INT >= 31) {
        return location.isMock();
      }
      //noinspection deprecation
      return location.isFromMockProvider();
    } catch (Exception e) {
      return false;
    }
  }

  private void maybePost(Location location, boolean force) {
    if (location == null || isMockLocation(location)) return;
    long now = System.currentTimeMillis();
    float acc = location.hasAccuracy() ? location.getAccuracy() : 999f;
    boolean fromGps = LocationManager.GPS_PROVIDER.equals(location.getProvider());

    // Utamakan titik GPS akurat; network kasar dibuang kalau GPS bagus < 45 dtk.
    if (!fromGps && lastGpsGood != null && now - lastGpsGood.getTime() < 45_000L) {
      if (acc > ACC_GOOD_M || (location.hasAccuracy() && lastGpsGood.hasAccuracy()
          && location.getAccuracy() > lastGpsGood.getAccuracy() + 15f)) {
        if (!force) return;
        location = lastGpsGood;
        acc = location.hasAccuracy() ? location.getAccuracy() : acc;
        fromGps = true;
      }
    }

    if (force) {
      boolean due = now - lastPostAt >= FORCE_POST_MS;
      if (!due && lastPosted != null) {
        float moved = location.distanceTo(lastPosted);
        if (moved < MIN_DIST_M) return;
      }
      if (acc > ACC_MAX_FORCE_M && now - lastPostAt < 45_000L) return;
    } else {
      if (lastPosted != null) {
        float moved = location.distanceTo(lastPosted);
        boolean stale = now - lastPostAt >= FORCE_POST_MS;
        if (moved < MIN_DIST_M && !stale) return;
        float accLimit = fromGps ? ACC_MAX_MOVE_M : Math.min(ACC_MAX_MOVE_M, 80f);
        if (acc > accLimit && !stale) return;
      } else if (acc > ACC_MAX_FORCE_M && now - lastPostAt < 30_000L) {
        return;
      }
    }
    lastPosted = location;
    lastPostAt = now;
    postAsync(location);
  }

  private static Location pickBetter(Location a, Location b) {
    if (a == null) return b;
    if (b == null) return a;
    boolean aGps = LocationManager.GPS_PROVIDER.equals(a.getProvider());
    boolean bGps = LocationManager.GPS_PROVIDER.equals(b.getProvider());
    long ageA = System.currentTimeMillis() - a.getTime();
    long ageB = System.currentTimeMillis() - b.getTime();
    // GPS segar menang dari network.
    if (aGps && !bGps && ageA < 60_000L) return a;
    if (bGps && !aGps && ageB < 60_000L) return b;
    if (ageA > 30_000L && ageB + 15_000L < ageA) return b;
    if (ageB > 30_000L && ageA + 15_000L < ageB) return a;
    if (!a.hasAccuracy()) return b;
    if (!b.hasAccuracy()) return a;
    return a.getAccuracy() <= b.getAccuracy() ? a : b;
  }

  private void postAsync(Location location) {
    SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
    final String token = p.getString(KEY_TOKEN, "");
    String api = p.getString(KEY_API, "https://www.gercepos.id");
    String traccar = p.getString(KEY_TRACCAR, "");
    if (token.isEmpty()) return;
    if (api.endsWith("/")) api = api.substring(0, api.length() - 1);
    if (traccar.endsWith("/")) traccar = traccar.substring(0, traccar.length() - 1);
    final String henimaUrl = api + "/api/henima-tracking/field/" + token + "/ping";
    final String traccarBase = traccar;
    final double lat = location.getLatitude();
    final double lng = location.getLongitude();
    final float acc = location.hasAccuracy() ? location.getAccuracy() : 50f;
    final String provider = location.getProvider() == null ? "" : location.getProvider();

    net.execute(() -> {
      // 1) HENIMA (absen/jual/pantau owner)
      postHenima(henimaUrl, token, lat, lng, acc, provider);
      // 2) Traccar OsmAnd langsung dari HP (mesin GPS) — tanpa Traccar Client
      if (!traccarBase.isEmpty()) {
        postTraccarOsmAnd(traccarBase, token, lat, lng, acc);
      }
    });
  }

  private void postHenima(String url, String token, double lat, double lng, float acc, String provider) {
    HttpURLConnection conn = null;
    try {
      JSONObject body = new JSONObject();
      body.put("lat", lat);
      body.put("lng", lng);
      body.put("accuracy_m", Math.round(acc));
      body.put("mock", false);
      body.put("provider", provider);
      byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);

      conn = (HttpURLConnection) new URL(url).openConnection();
      conn.setConnectTimeout(15000);
      conn.setReadTimeout(20000);
      conn.setRequestMethod("POST");
      conn.setDoOutput(true);
      conn.setRequestProperty("Content-Type", "application/json");
      conn.setRequestProperty("Accept", "application/json");
      try (OutputStream os = conn.getOutputStream()) {
        os.write(bytes);
      }
      int code = conn.getResponseCode();
      if (code == 409) {
        handler.post(this::stopSelfSafe);
      }
    } catch (Exception e) {
      Log.w(TAG, "henima ping failed", e);
    } finally {
      if (conn != null) conn.disconnect();
    }
  }

  /** Protokol OsmAnd Traccar — HP → server Traccar langsung. */
  private void postTraccarOsmAnd(String base, String token, double lat, double lng, float acc) {
    HttpURLConnection conn = null;
    try {
      String id = "henima-" + (token.length() >= 16 ? token.substring(0, 16) : token);
      StringBuilder q = new StringBuilder();
      q.append("id=").append(id);
      q.append("&lat=").append(lat);
      q.append("&lon=").append(lng);
      q.append("&timestamp=").append(System.currentTimeMillis() / 1000L);
      q.append("&speed=0&bearing=0&altitude=0");
      q.append("&accuracy=").append(Math.round(acc));
      q.append("&hdop=").append(Math.max(0.5, Math.min(50.0, acc / 5.0)));
      String url = base.contains("?") ? base + "&" + q : base + "/?" + q;

      conn = (HttpURLConnection) new URL(url).openConnection();
      conn.setConnectTimeout(8000);
      conn.setReadTimeout(8000);
      conn.setRequestMethod("GET");
      conn.getResponseCode();
    } catch (Exception e) {
      Log.w(TAG, "traccar osmand failed", e);
    } finally {
      if (conn != null) conn.disconnect();
    }
  }

  private static boolean isPastCloseWib() {
    Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Jakarta"));
    return cal.get(Calendar.HOUR_OF_DAY) >= 18;
  }

  private void ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationChannel ch = new NotificationChannel(CHANNEL, "Henima GPS", NotificationManager.IMPORTANCE_LOW);
    ch.setDescription("GPS sales lapangan tetap hidup di belakang");
    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm != null) nm.createNotificationChannel(ch);
  }

  private Notification buildNotification(String text) {
    Intent open = new Intent(this, MainActivity.class);
    PendingIntent pi = PendingIntent.getActivity(
        this,
        0,
        open,
        PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)
    );
    return new NotificationCompat.Builder(this, CHANNEL)
        .setContentTitle("Henima · GPS live")
        .setContentText(text)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setOngoing(true)
        .setContentIntent(pi)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build();
  }

  private void stopSelfSafe() {
    SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
    p.edit().putBoolean(KEY_ACTIVE, false).apply();
    cancelWatchdog(this);
    try {
      if (locationManager != null) locationManager.removeUpdates(this);
    } catch (Exception ignored) {
    }
    handler.removeCallbacks(heartbeat);
    releaseWakeLock();
    stopForeground(true);
    stopSelf();
  }

  @Override
  public void onTaskRemoved(Intent rootIntent) {
    // Clear recent / swipe app: kirim titik terakhir (jejak "mau ditutup") lalu coba nyala lagi.
    SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
    if (p.getBoolean(KEY_ACTIVE, false) && !isPastCloseWib()) {
      try {
        if (lastPosted != null) postAsync(lastPosted);
        else if (lastGpsGood != null) postAsync(lastGpsGood);
      } catch (Exception ignored) {
      }
      scheduleQuickRestart(getApplicationContext());
      scheduleWatchdog(getApplicationContext());
    }
    super.onTaskRemoved(rootIntent);
  }

  @Override
  public void onDestroy() {
    handler.removeCallbacks(heartbeat);
    try {
      if (locationManager != null) locationManager.removeUpdates(this);
    } catch (Exception ignored) {
    }
    releaseWakeLock();
    SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
    boolean want = p.getBoolean(KEY_ACTIVE, false) && !isPastCloseWib();
    if (want) {
      scheduleQuickRestart(getApplicationContext());
      scheduleWatchdog(getApplicationContext());
    }
    net.shutdownNow();
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public void onStatusChanged(String provider, int status, Bundle extras) {}

  @Override
  public void onProviderEnabled(String provider) {
    startListening();
  }

  @Override
  public void onProviderDisabled(String provider) {}
}
