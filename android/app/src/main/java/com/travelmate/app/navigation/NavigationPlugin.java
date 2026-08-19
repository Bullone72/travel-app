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
        Double startLat = call.getDouble("startLat");
        Double startLng = call.getDouble("startLng");
        Double endLat = call.getDouble("endLat");
        Double endLng = call.getDouble("endLng");

        if (startLat == null || startLng == null || endLat == null || endLng == null) {
            call.reject("Missing coordinates");
            return;
        }

        String url = "https://wego.here.com/directions?from=" + startLat + "," + startLng + "&to=" + endLat + "," + endLng;

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.setPackage("com.here.app.navi");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve(new JSObject().put("opened", true));
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
                call.resolve(new JSObject().put("opened", true));
            } catch (Exception e2) {
                call.reject("Nessuna app di navigazione trovata");
            }
        }
    }
}
