package io.github.miguelav33.minimapa;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ajustes del sistema que hacen que la navegación funcione bien con la pantalla apagada:
 * notificaciones, ahorro de batería y acceso rápido a Android Auto.
 */
@CapacitorPlugin(name = "Sistema")
public class SistemaPlugin extends Plugin {

    static final String ANDROID_AUTO = "com.google.android.projection.gearhead";

    @PluginMethod
    public void status(PluginCall call) {
        Context ctx = getContext();
        JSObject r = new JSObject();
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("notifications", notificationsGranted(ctx));
        r.put("battery", ignoringBattery(ctx));
        r.put("androidAuto", isInstalled(ctx, ANDROID_AUTO));
        r.put("manufacturer", Build.MANUFACTURER);
        call.resolve(r);
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && !notificationsGranted(getContext()) && getActivity() != null) {
            ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 4201);
        }
        call.resolve();
    }

    /** Pide quitar la optimización de batería (evita que Xiaomi, Samsung, etc. cierren el GPS). */
    @PluginMethod
    public void requestBattery(PluginCall call) {
        Context ctx = getContext();
        if (ignoringBattery(ctx)) {
            call.resolve();
            return;
        }
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (ActivityNotFoundException e) {
            open(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        }
        call.resolve();
    }

    @PluginMethod
    public void openAndroidAuto(PluginCall call) {
        Context ctx = getContext();
        Intent i = ctx.getPackageManager().getLaunchIntentForPackage(ANDROID_AUTO);
        if (i != null) {
            open(i);
        } else {
            open(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + ANDROID_AUTO)));
        }
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        open(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())));
        call.resolve();
    }

    private void open(Intent i) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception ignored) {
            // no hay pantalla de ajustes equivalente en este móvil
        }
    }

    static boolean notificationsGranted(Context ctx) {
        if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return NotificationManagerCompat.from(ctx).areNotificationsEnabled();
    }

    static boolean ignoringBattery(Context ctx) {
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
    }

    static boolean isInstalled(Context ctx, String pkg) {
        try {
            ctx.getPackageManager().getPackageInfo(pkg, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
