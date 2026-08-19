package com.travelmate.app.navigation;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Navigation")
public class NavigationPlugin extends Plugin {

    @PluginMethod
    public void openHereWeGo(PluginCall call) {
        String shareUrl = call.getString("shareUrl");

        if (shareUrl == null || shareUrl.isEmpty()) {
            call.reject("Missing shareUrl");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(shareUrl));
            intent.setPackage("com.here.app.maps");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve(new JSObject().put("opened", true));
            return;
        } catch (Exception ignored) {}

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(shareUrl));
            intent.setPackage("com.here.app.navi");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve(new JSObject().put("opened", true));
            return;
        } catch (Exception ignored) {}

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(shareUrl));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve(new JSObject().put("opened", true));
        } catch (Exception e) {
            call.reject("Nessuna app di navigazione trovata");
        }
    }
}
