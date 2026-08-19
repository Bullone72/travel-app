package com.travelmate.app;

import android.os.Handler;
import android.os.Looper;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.travelmate.app.navigation.NavigationPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(NavigationPlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            webView.loadUrl("https://travel-app-tau-ashen.vercel.app/?_t=" + System.currentTimeMillis());
        }, 200);
    }
}
