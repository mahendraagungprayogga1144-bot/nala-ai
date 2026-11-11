package id.gercepos.henima.sales;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import java.util.Calendar;
import java.util.TimeZone;

/**
 * Nyala ulang GPS native kalau OEM / clear RAM mematikan service,
 * selama sesi tracking masih aktif (KEY_ACTIVE) dan sebelum jam 18 WIB.
 */
public class HenimaWatchdogReceiver extends BroadcastReceiver {
  public static final String ACTION_WATCHDOG = "id.gercepos.henima.sales.TRACK_WATCHDOG";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (context == null) return;

    Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Jakarta"));
    if (cal.get(Calendar.HOUR_OF_DAY) >= 18) return;

    SharedPreferences p = context.getSharedPreferences(HenimaTrackService.PREFS, Context.MODE_PRIVATE);
    String token = p.getString(HenimaTrackService.KEY_TOKEN, "");
    String api = p.getString(HenimaTrackService.KEY_API, "https://www.gercepos.id");
    String traccar = p.getString(HenimaTrackService.KEY_TRACCAR, "");
    boolean want = p.getBoolean(HenimaTrackService.KEY_ACTIVE, false);
    if (!want || token.length() != 32) return;

    HenimaTrackService.start(context, token, api, traccar);
  }
}
