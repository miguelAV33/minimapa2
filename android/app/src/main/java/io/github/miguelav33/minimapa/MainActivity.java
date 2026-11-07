package io.github.miguelav33.minimapa;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import io.github.miguelav33.minimapa.car.CarBridgePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Los plugins propios se registran antes de crear el puente con el WebView
        registerPlugin(CarBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
