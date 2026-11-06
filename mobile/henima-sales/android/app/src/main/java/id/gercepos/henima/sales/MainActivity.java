package id.gercepos.henima.sales;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(HenimaTrackPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
