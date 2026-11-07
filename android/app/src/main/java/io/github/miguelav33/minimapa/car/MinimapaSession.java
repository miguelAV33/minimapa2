package io.github.miguelav33.minimapa.car;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.core.app.NotificationCompat;

import androidx.annotation.NonNull;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.car.app.navigation.NavigationManager;
import androidx.car.app.navigation.NavigationManagerCallback;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import io.github.miguelav33.minimapa.MainActivity;
import io.github.miguelav33.minimapa.R;

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
        renderer.setDark(getCarContext().isDarkMode());
        // Si la app del móvil no está abierta, se intenta abrir y se deja una notificación para tocarla
        new Handler(Looper.getMainLooper()).postDelayed(this::nudgePhoneApp, 2500);
        return new NavScreen(getCarContext(), renderer, nm);
    }

    @Override
    public void onCarConfigurationChanged(@NonNull Configuration newConfiguration) {
        if (renderer != null) renderer.setDark(getCarContext().isDarkMode());
    }

    static final int NOTIF_ID = 4202;
    static final String CHANNEL = "minimapa_coche";

    private void nudgePhoneApp() {
        if (CarState.get().brainAlive()) return;
        Context app = getCarContext().getApplicationContext();
        Intent open = new Intent(app, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        try {
            app.startActivity(open);
        } catch (Exception ignored) {
            // Android puede impedir abrir pantallas desde segundo plano: queda la notificación
        }
        try {
            NotificationManager nm = (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 26) {
                nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Android Auto", NotificationManager.IMPORTANCE_HIGH));
            }
            PendingIntent pi = PendingIntent.getActivity(app, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            Notification n = new NotificationCompat.Builder(app, CHANNEL)
                    .setSmallIcon(R.drawable.ic_stat_minimapa)
                    .setContentTitle("Minimapa está en el coche")
                    .setContentText("Toca para activar la navegación y los avisos de radar")
                    .setContentIntent(pi)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .build();
            nm.notify(NOTIF_ID, n);
        } catch (Exception ignored) {
            // sin permiso de notificaciones
        }
    }

    @Override
    public void onDestroy(@NonNull LifecycleOwner owner) {
        CarState.get().sessionEnded();
        if (renderer != null) renderer.release();
        renderer = null;
    }
}
