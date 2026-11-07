package io.github.miguelav33.minimapa.car;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Puente entre el JavaScript de la app y Android Auto.
 * JS: Capacitor.Plugins.CarBridge.update({...}) y addListener('carAction', fn)
 */
@CapacitorPlugin(name = "CarBridge")
public class CarBridgePlugin extends Plugin {

    @Override
    public void load() {
        CarState.get().setActionSink((action, data) -> {
            JSObject o = new JSObject();
            o.put("action", action);
            if (data != null) o.put("data", data);
            notifyListeners("carAction", o, true);
        });
        CarState.get().setBrainAlive(true);
    }

    @Override
    protected void handleOnDestroy() {
        CarState.get().setBrainAlive(false);
        CarState.get().setActionSink(null);
    }

    /** Datos de cada segundo: posición, velocidad, avisos y maniobra. */
    @PluginMethod
    public void update(PluginCall call) {
        CarState.get().setLive(call.getString("live"), call.getObject("nav"));
        call.resolve();
    }

    @PluginMethod
    public void setRoute(PluginCall call) {
        CarState.get().setRoute(call.getString("json"));
        call.resolve();
    }

    @PluginMethod
    public void setRadars(PluginCall call) {
        CarState.get().setRadars(call.getString("json"));
        call.resolve();
    }

    @PluginMethod
    public void setSettings(PluginCall call) {
        CarState.get().setSettings(call.getString("json"));
        call.resolve();
    }

    @PluginMethod
    public void setPlaces(PluginCall call) {
        JSArray list = call.getArray("places");
        CarState.get().setPlaces(list);
        call.resolve();
    }

    /** Iconos de maniobra en PNG (base64) dibujados por la app con el mismo diseño. */
    @PluginMethod
    public void setIcons(PluginCall call) {
        CarState.get().setIcons(decode(call.getString("current")), decode(call.getString("next")));
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("connected", CarState.get().isCarActive());
        call.resolve(r);
    }

    private static Bitmap decode(String b64) {
        if (b64 == null || b64.isEmpty()) return null;
        try {
            int comma = b64.indexOf(',');
            byte[] bytes = Base64.decode(comma >= 0 ? b64.substring(comma + 1) : b64, Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception e) {
            return null;
        }
    }
}
