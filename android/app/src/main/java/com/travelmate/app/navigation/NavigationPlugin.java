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

        String[] packages = {"com.here.app.maps", "com.here.app.navi"};

        for (String pkg : packages) {
            try {
                Intent intent = new Intent("com.here.maps.DIRECTIONS");
                intent.setPackage(pkg);
                intent.setData(Uri.parse(shareUrl));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
                call.resolve(new JSObject().put("opened", true));
                return;
            } catch (Exception ignored) {}
        }

        for (String pkg : packages) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(shareUrl));
                intent.setPackage(pkg);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
                call.resolve(new JSObject().put("opened", true));
                return;
            } catch (Exception ignored) {}
        }

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
