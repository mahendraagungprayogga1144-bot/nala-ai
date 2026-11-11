package id.gercepos.henima.sales;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import java.util.Calendar;
import java.util.TimeZone;

/** Restart GPS native setelah HP reboot (kalau masih jam kerja). */
public class HenimaBootReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null || intent.getAction() == null) return;
    if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
        && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) {
      return;
    }
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

