package com.travelmate.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.travelmate.app.navigation.NavigationPlugin;
import java.io.File;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NavigationPlugin.class);

        clearWebViewCache();

        super.onCreate(savedInstanceState);
    }

    private void clearWebViewCache() {
        try {
            File cacheDir = getCacheDir();
            if (cacheDir != null && cacheDir.exists()) {
                deleteRecursive(new File(cacheDir, "WebView"));
                deleteRecursive(new File(cacheDir, "webview"));
            }
            File codeCacheDir = getCodeCacheDir();
            if (codeCacheDir != null && codeCacheDir.exists()) {
                deleteRecursive(new File(codeCacheDir, "WebView"));
                deleteRecursive(new File(codeCacheDir, "webview"));
            }
        } catch (Exception ignored) {}
    }

    private void deleteRecursive(File fileOrDir) {
        if (fileOrDir == null || !fileOrDir.exists()) return;
        if (fileOrDir.isDirectory()) {
            File[] children = fileOrDir.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        fileOrDir.delete();
    }
}
