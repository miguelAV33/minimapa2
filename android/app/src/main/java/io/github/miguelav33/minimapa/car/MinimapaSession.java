package io.github.miguelav33.minimapa.car;

import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.car.app.navigation.NavigationManager;
import androidx.car.app.navigation.NavigationManagerCallback;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

/** Una sesión por cada conexión con el coche. */
public class MinimapaSession extends Session implements DefaultLifecycleObserver {

    private CarMapRenderer renderer;

    public MinimapaSession() {
        getLifecycle().addObserver(this);
    }

    @NonNull
    @Override
    public Screen onCreateScreen(@NonNull Intent intent) {
        renderer = new CarMapRenderer(getCarContext());
        NavigationManager nm = getCarContext().getCarService(NavigationManager.class);
        nm.setNavigationManagerCallback(new NavigationManagerCallback() {
            @Override
            public void onStopNavigation() {
                CarState.get().sendAction("endNav", null);
            }

            @Override
            public void onAutoDriveEnabled() {
                // No hay conducción automática simulada desde el coche
            }
        });
        CarState.get().sessionStarted();
        return new NavScreen(getCarContext(), renderer, nm);
    }

    @Override
    public void onDestroy(@NonNull LifecycleOwner owner) {
        CarState.get().sessionEnded();
        if (renderer != null) renderer.release();
        renderer = null;
    }
}
