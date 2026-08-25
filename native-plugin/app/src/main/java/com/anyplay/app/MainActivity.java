package com.anyplay.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AnyPlayNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
