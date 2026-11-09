package io.github.miguelav33.minimapa.car;

import android.graphics.Bitmap;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * Estado compartido entre la app del móvil (que calcula rutas, GPS y avisos en JavaScript)
 * y la pantalla de Android Auto, que solo muestra lo que recibe y devuelve acciones.
 */
public final class CarState {

    public interface Listener {
        /** what: "live", "route", "radars", "settings", "places", "icons", "brain" */
        void onCarStateChanged(String what);
    }

    public interface ActionSink {
        void send(String action, JSONObject data);
    }

    private static final CarState INSTANCE = new CarState();

    public static CarState get() {
        return INSTANCE;
    }

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Set<Listener> listeners = new CopyOnWriteArraySet<>();

    private volatile String liveJson;
    private volatile String routeJson;
    private volatile String radarsJson;
    private volatile String settingsJson;
    private volatile JSONObject nav;
    private volatile JSONArray places = new JSONArray();
    private volatile Bitmap currentIcon;
    private volatile Bitmap nextIcon;
    private volatile Bitmap lanesIcon;
    private volatile boolean brainAlive;
    private volatile long lastLiveAt;
    private volatile int carSessions;
    private volatile ActionSink sink;

    private CarState() {
    }

    // ---- Escuchas ----

    public void addListener(Listener l) {
        listeners.add(l);
    }

    public void removeListener(Listener l) {
        listeners.remove(l);
    }

    private void emit(final String what) {
        main.post(() -> {
            for (Listener l : listeners) {
                try {
                    l.onCarStateChanged(what);
                } catch (Exception ignored) {
                    // Un fallo en la pantalla del coche no debe tumbar la app
                }
            }
        });
    }

    // ---- Datos que envía la app del móvil ----

    public void setLive(String json, JSONObject navInfo) {
        liveJson = json;
        nav = navInfo;
        lastLiveAt = System.currentTimeMillis();
        emit("live");
    }

    public void setRoute(String json) {
        routeJson = json;
        emit("route");
    }

    public void setRadars(String json) {
        radarsJson = json;
        emit("radars");
    }

    public void setSettings(String json) {
        settingsJson = json;
        emit("settings");
    }

    public void setPlaces(JSONArray list) {
        places = list != null ? list : new JSONArray();
        emit("places");
    }

    public void setIcons(Bitmap current, Bitmap next, Bitmap lanes) {
        currentIcon = current;
        nextIcon = next;
        lanesIcon = lanes;
        emit("icons");
    }

    public void setBrainAlive(boolean alive) {
        brainAlive = alive;
        emit("brain");
    }

    // ---- Lectura ----

    public String liveJson() { return liveJson; }
    public String routeJson() { return routeJson; }
    public String radarsJson() { return radarsJson; }
    public String settingsJson() { return settingsJson; }
    public JSONObject nav() { return nav; }
    public JSONArray places() { return places; }
    public Bitmap currentIcon() { return currentIcon; }
    public Bitmap nextIcon() { return nextIcon; }
    public Bitmap lanesIcon() { return lanesIcon; }

    /** La app del móvil está abierta y ha mandado datos hace poco. */
    public boolean brainAlive() {
        return brainAlive && System.currentTimeMillis() - lastLiveAt < 30000;
    }

    // ---- Coche conectado ----

    public synchronized void sessionStarted() {
        carSessions++;
        sendAction("carConnected", null);
    }

    public synchronized void sessionEnded() {
        carSessions = Math.max(0, carSessions - 1);
        if (carSessions == 0) sendAction("carDisconnected", null);
    }

    public boolean isCarActive() {
        return carSessions > 0;
    }

    // ---- Acciones del coche hacia la app ----

    public void setActionSink(ActionSink s) {
        sink = s;
    }

    public void sendAction(String action, JSONObject data) {
        ActionSink s = sink;
        if (s != null) {
            try {
                s.send(action, data);
            } catch (Exception ignored) {
                // la app del móvil no está escuchando
            }
        }
    }
}
