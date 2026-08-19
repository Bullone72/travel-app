package com.travelmate.app;

import com.getcapacitor.BridgeActivity;
import com.travelmate.app.navigation.NavigationPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(NavigationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
