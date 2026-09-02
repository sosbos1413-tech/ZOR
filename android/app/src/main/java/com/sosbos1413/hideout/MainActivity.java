package com.sosbos1413.hideout;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Thin WebView shell around the game. HIDEOUT is a single self-contained HTML file with no
 * network dependencies, so it is bundled as an asset and runs entirely offline.
 */
public class MainActivity extends Activity {

  private WebView web;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    web = new WebView(this);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    // The game stores its save in localStorage; without DOM storage every run is lost on exit.
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    // Keep the page at its own scale: the layout is already portrait-first and responsive.
    settings.setUseWideViewPort(false);
    settings.setLoadWithOverviewMode(false);
    settings.setSupportZoom(false);
    settings.setBuiltInZoomControls(false);

    web.setWebViewClient(new WebViewClient());
    web.setBackgroundColor(0xFF0B0F17);
    web.loadUrl("file:///android_asset/hideout.html");

    setContentView(web);
  }

  @Override
  public void onBackPressed() {
    if (web != null && web.canGoBack()) {
      web.goBack();
    } else {
      super.onBackPressed();
    }
  }
}
