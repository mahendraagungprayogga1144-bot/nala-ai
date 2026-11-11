package id.gercepos.henima.sales;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Bridge JS → native GPS service (jalan terus di belakang seperti Grab).
 */
@CapacitorPlugin(
    name = "HenimaTrack",
    permissions = {
      @Permission(
          alias = "location",
          strings = {
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
          }),
      @Permission(
          alias = "background",
          strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION })
    })
public class HenimaTrackPlugin extends Plugin {

  @PluginMethod
  public void start(PluginCall call) {
    String token = call.getString("token", "");
    String apiBase = call.getString("apiBase", "https://www.gercepos.id");
    if (token == null || token.length() != 32) {
      call.reject("Token tracking tidak valid");
      return;
    }
    if (getPermissionState("location") != com.getcapacitor.PermissionState.GRANTED) {
      requestPermissionForAlias("location", call, "locationPermsCallback");
      return;
    }
    // Android 10+: minta "Izinkan selalu" sekali (kalau masih prompt).
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
        && getPermissionState("background") == com.getcapacitor.PermissionState.PROMPT) {
      requestPermissionForAlias("background", call, "backgroundPermsCallback");
      return;
    }
    startServiceFromCall(call);
  }

  @PermissionCallback
  private void locationPermsCallback(PluginCall call) {
    if (getPermissionState("location") == com.getcapacitor.PermissionState.GRANTED) {
      start(call);
    } else {
      call.reject("Izin lokasi ditolak");
    }
  }

  @PermissionCallback
  private void backgroundPermsCallback(PluginCall call) {
    // Tetap start meski background ditolak — foreground service masih kirim saat notifikasi hidup.
    startServiceFromCall(call);
  }

  private void startServiceFromCall(PluginCall call) {
    String token = call.getString("token", "");
    String apiBase = call.getString("apiBase", "https://www.gercepos.id");
    String traccarOsmAnd = call.getString("traccarOsmAnd", "");
    if (token == null || token.length() != 32) {
      call.reject("Token tracking tidak valid");
      return;
    }
    HenimaTrackService.start(
        getContext(),
        token.toLowerCase(),
        apiBase == null ? "https://www.gercepos.id" : apiBase,
        traccarOsmAnd == null ? "" : traccarOsmAnd);
    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void stop(PluginCall call) {
    HenimaTrackService.stop(getContext());
    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void isRunning(PluginCall call) {
    boolean active = getContext()
        .getSharedPreferences(HenimaTrackService.PREFS, Context.MODE_PRIVATE)
        .getBoolean(HenimaTrackService.KEY_ACTIVE, false);
    JSObject ret = new JSObject();
    ret.put("running", active);
    call.resolve(ret);
  }

  @PluginMethod
  public void requestIgnoreBatteryOptimizations(PluginCall call) {
    try {
      Context ctx = getContext();
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        String pkg = ctx.getPackageName();
        if (pm != null && !pm.isIgnoringBatteryOptimizations(pkg)) {
          Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
          intent.setData(Uri.parse("package:" + pkg));
          intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          getActivity().startActivity(intent);
        }
      }
      JSObject ret = new JSObject();
      ret.put("ok", true);
      call.resolve(ret);
    } catch (Exception e) {
      call.reject(e.getMessage());
    }
  }
}
