package com.travelmate.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.travelmate.app.navigation.NavigationPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NavigationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
