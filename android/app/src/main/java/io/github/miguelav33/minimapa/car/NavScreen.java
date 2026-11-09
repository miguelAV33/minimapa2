package io.github.miguelav33.minimapa.car;

import android.graphics.Bitmap;
import android.os.SystemClock;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarColor;
import androidx.car.app.model.CarIcon;
import androidx.car.app.model.DateTimeWithZone;
import androidx.car.app.model.Distance;
import androidx.car.app.model.Template;
import androidx.car.app.navigation.NavigationManager;
import androidx.car.app.navigation.model.Lane;
import androidx.car.app.navigation.model.LaneDirection;
import androidx.car.app.navigation.model.Maneuver;
import androidx.car.app.navigation.model.MessageInfo;
import androidx.car.app.navigation.model.NavigationTemplate;
import androidx.car.app.navigation.model.RoutingInfo;
import androidx.car.app.navigation.model.Step;
import androidx.car.app.navigation.model.TravelEstimate;
import androidx.core.graphics.drawable.IconCompat;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.TimeZone;

import io.github.miguelav33.minimapa.R;

/** Pantalla principal en el coche: mapa propio + tarjeta de maniobra, llegada y botones. */
public class NavScreen extends Screen implements CarState.Listener, DefaultLifecycleObserver {

    private static final long MIN_REFRESH_MS = 900;

    private final CarMapRenderer renderer;
    private final NavigationManager navManager;
    private boolean navigating;
    private long lastInvalidate;
    private boolean pendingInvalidate;
    private final android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());

    public NavScreen(@NonNull CarContext carContext, @NonNull CarMapRenderer renderer, @NonNull NavigationManager navManager) {
        super(carContext);
        this.renderer = renderer;
        this.navManager = navManager;
        getLifecycle().addObserver(this);
    }

    @Override
    public void onCreate(@NonNull LifecycleOwner owner) {
        CarState.get().addListener(this);
    }

    @Override
    public void onDestroy(@NonNull LifecycleOwner owner) {
        CarState.get().removeListener(this);
        setNavigating(false);
    }

    @Override
    public void onCarStateChanged(String what) {
        if (!"live".equals(what) && !"brain".equals(what) && !"icons".equals(what)) return;
        JSONObject nav = CarState.get().nav();
        boolean active = nav != null && nav.optBoolean("active");
        setNavigating(active);
        long now = SystemClock.uptimeMillis();
        if (now - lastInvalidate >= MIN_REFRESH_MS) {
            lastInvalidate = now;
            invalidate();
        } else if (!pendingInvalidate) {
            pendingInvalidate = true;
            handler.postDelayed(() -> {
                pendingInvalidate = false;
                lastInvalidate = SystemClock.uptimeMillis();
                invalidate();
            }, MIN_REFRESH_MS);
        }
    }

    private void setNavigating(boolean active) {
        if (active == navigating) return;
        navigating = active;
        try {
            if (active) navManager.navigationStarted();
            else navManager.navigationEnded();
        } catch (Exception ignored) {
            // El anfitrión puede rechazarlo si otra app está navegando
        }
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        CarState state = CarState.get();
        JSONObject nav = state.nav();
        NavigationTemplate.Builder b = new NavigationTemplate.Builder();
        b.setBackgroundColor(CarColor.createCustom(0xFF4A2370, 0xFF3A1B58));

        if (!state.brainAlive()) {
            b.setNavigationInfo(new MessageInfo.Builder("Abre Minimapa en el móvil")
                    .setText("La app del móvil calcula la ruta y los avisos de radar. Ábrela una vez y déjala en segundo plano.")
                    .build());
        } else if (nav != null && nav.optBoolean("active")) {
            if (nav.optBoolean("loading")) {
                b.setNavigationInfo(new RoutingInfo.Builder().setLoading(true).build());
            } else {
                JSONObject cur = nav.optJSONObject("cur");
                if (cur != null) {
                    RoutingInfo.Builder rb = new RoutingInfo.Builder()
                            .setCurrentStep(step(cur, state.currentIcon(), state.lanesIcon()), distance(nav.optDouble("distNext", 0)));
                    JSONObject next = nav.optJSONObject("next");
                    if (next != null) rb.setNextStep(step(next, state.nextIcon(), null));
                    b.setNavigationInfo(rb.build());
                }
            }
            double remaining = nav.optDouble("remaining", 0);
            long remainingSec = Math.max(0, (long) nav.optDouble("remainingTime", 0));
            long eta = System.currentTimeMillis() + remainingSec * 1000L;
            b.setDestinationTravelEstimate(new TravelEstimate.Builder(distance(remaining),
                    DateTimeWithZone.create(eta, TimeZone.getDefault()))
                    .setRemainingTimeSeconds(remainingSec)
                    .setRemainingTimeColor(CarColor.GREEN)
                    .build());
        } else {
            String title = "Modo libre";
            String text = "Avisos de radar activos. Pulsa Destinos para ir a algún sitio.";
            if (nav != null) {
                JSONObject alert = nav.optJSONObject("alert");
                if (alert != null && !alert.optString("text").isEmpty()) {
                    title = alert.optString("title", "Radar");
                    text = alert.optString("text");
                } else if (!nav.optString("street").isEmpty()) {
                    title = nav.optString("street");
                    text = nav.optString("locality", text);
                }
            }
            b.setNavigationInfo(new MessageInfo.Builder(title).setText(text).build());
        }

        // Botones superiores (máximo 4)
        ActionStrip.Builder strip = new ActionStrip.Builder();
        strip.addAction(new Action.Builder()
                .setTitle("Destinos")
                .setIcon(icon(R.drawable.ic_car_search))
                .setOnClickListener(() -> getScreenManager().push(new PlacesScreen(getCarContext())))
                .build());
        boolean voice = nav == null || nav.optBoolean("voice", true);
        strip.addAction(new Action.Builder()
                .setIcon(icon(voice ? R.drawable.ic_car_volume : R.drawable.ic_car_mute))
                .setOnClickListener(() -> CarState.get().sendAction("toggleVoice", null))
                .build());
        if (navigating) {
            strip.addAction(new Action.Builder()
                    .setTitle("Fin")
                    .setOnClickListener(() -> CarState.get().sendAction("endNav", null))
                    .build());
        }
        b.setActionStrip(strip.build());

        // Botones del mapa (solo iconos)
        b.setMapActionStrip(new ActionStrip.Builder()
                .addAction(Action.PAN)
                .addAction(new Action.Builder().setIcon(icon(R.drawable.ic_car_zoom_in))
                        .setOnClickListener(() -> renderer.action("zoomIn")).build())
                .addAction(new Action.Builder().setIcon(icon(R.drawable.ic_car_zoom_out))
                        .setOnClickListener(() -> renderer.action("zoomOut")).build())
                .addAction(new Action.Builder().setIcon(icon(R.drawable.ic_car_recenter))
                        .setOnClickListener(() -> renderer.action("recenter")).build())
                .build());
        b.setPanModeListener(renderer::setPanMode);
        return b.build();
    }

    private CarIcon icon(int res) {
        return new CarIcon.Builder(IconCompat.createWithResource(getCarContext(), res)).build();
    }

    private static Distance distance(double meters) {
        if (meters >= 10000) return Distance.create(Math.round(meters / 1000.0), Distance.UNIT_KILOMETERS);
        if (meters >= 1000) return Distance.create(Math.round(meters / 100.0) / 10.0, Distance.UNIT_KILOMETERS_P1);
        double m = meters < 100 ? Math.round(meters / 10.0) * 10.0 : Math.round(meters / 50.0) * 50.0;
        return Distance.create(Math.max(0, m), Distance.UNIT_METERS);
    }

    private static Step step(JSONObject s, Bitmap iconBitmap, Bitmap lanesBitmap) {
        JSONArray lanes = s.optJSONArray("lanes");
        if (lanes != null && lanesBitmap != null) {
            try {
                return buildStep(s, iconBitmap, lanes, lanesBitmap);
            } catch (RuntimeException e) {
                // Si el coche no acepta los carriles, se muestra la maniobra sin ellos
            }
        }
        return buildStep(s, iconBitmap, null, null);
    }

    private static Step buildStep(JSONObject s, Bitmap iconBitmap, JSONArray lanes, Bitmap lanesBitmap) {
        String text = s.optString("text", "Continúa");
        Step.Builder sb = new Step.Builder(text.isEmpty() ? "Continúa" : text);
        int type = maneuverType(s.optString("kind"), s.optInt("exit", 0));
        Maneuver.Builder mb = new Maneuver.Builder(type);
        if (type == Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW) mb.setRoundaboutExitNumber(Math.max(1, s.optInt("exit", 1)));
        if (iconBitmap != null) mb.setIcon(new CarIcon.Builder(IconCompat.createWithBitmap(iconBitmap)).build());
        sb.setManeuver(mb.build());
        String road = s.optString("street");
        if (!road.isEmpty()) sb.setRoad(road);
        if (lanes != null && lanesBitmap != null) {
            for (int i = 0; i < lanes.length(); i++) {
                JSONObject l = lanes.optJSONObject(i);
                if (l == null) continue;
                int d = l.optInt("d", 1), good = l.optInt("a", 0) != 0 ? l.optInt("a", 0) : l.optInt("v", 0);
                Lane.Builder lb = new Lane.Builder();
                boolean any = false;
                for (int[] bit : LANE_SHAPES) {
                    if ((d & bit[0]) != 0) { lb.addDirection(LaneDirection.create(bit[1], (good & bit[0]) != 0)); any = true; }
                }
                if (!any) lb.addDirection(LaneDirection.create(LaneDirection.SHAPE_STRAIGHT, good != 0));
                sb.addLane(lb.build());
            }
            sb.setLanesImage(new CarIcon.Builder(IconCompat.createWithBitmap(lanesBitmap)).build());
        }
        return sb.build();
    }

    /** Bit de dirección de carril (Valhalla) → forma de Android Auto. */
    private static final int[][] LANE_SHAPES = {
            {1, LaneDirection.SHAPE_STRAIGHT}, {2, LaneDirection.SHAPE_STRAIGHT},
            {4, LaneDirection.SHAPE_SHARP_LEFT}, {8, LaneDirection.SHAPE_NORMAL_LEFT}, {16, LaneDirection.SHAPE_SLIGHT_LEFT},
            {32, LaneDirection.SHAPE_SLIGHT_RIGHT}, {64, LaneDirection.SHAPE_NORMAL_RIGHT}, {128, LaneDirection.SHAPE_SHARP_RIGHT},
            {256, LaneDirection.SHAPE_U_TURN_LEFT}, {512, LaneDirection.SHAPE_SLIGHT_LEFT}, {1024, LaneDirection.SHAPE_SLIGHT_RIGHT},
    };

    /** Traduce el tipo de maniobra de la app al de Android Auto (en España las rotondas giran a la izquierda). */
    static int maneuverType(String kind, int exit) {
        switch (kind) {
            case "depart": return Maneuver.TYPE_DEPART;
            case "straight": return Maneuver.TYPE_STRAIGHT;
            case "slight-right": return Maneuver.TYPE_TURN_SLIGHT_RIGHT;
            case "right": return Maneuver.TYPE_TURN_NORMAL_RIGHT;
            case "sharp-right": return Maneuver.TYPE_TURN_SHARP_RIGHT;
            case "slight-left": return Maneuver.TYPE_TURN_SLIGHT_LEFT;
            case "left": return Maneuver.TYPE_TURN_NORMAL_LEFT;
            case "sharp-left": return Maneuver.TYPE_TURN_SHARP_LEFT;
            case "uturn": return Maneuver.TYPE_U_TURN_LEFT;
            case "keep-right": return Maneuver.TYPE_KEEP_RIGHT;
            case "keep-left": return Maneuver.TYPE_KEEP_LEFT;
            case "ramp-right": return Maneuver.TYPE_ON_RAMP_NORMAL_RIGHT;
            case "ramp-left": return Maneuver.TYPE_ON_RAMP_NORMAL_LEFT;
            case "exit-right": return Maneuver.TYPE_OFF_RAMP_NORMAL_RIGHT;
            case "exit-left": return Maneuver.TYPE_OFF_RAMP_NORMAL_LEFT;
            case "merge": return Maneuver.TYPE_MERGE_SIDE_UNSPECIFIED;
            case "roundabout": return exit > 0 ? Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW : Maneuver.TYPE_ROUNDABOUT_ENTER_CCW;
            case "roundabout-exit": return Maneuver.TYPE_ROUNDABOUT_EXIT_CCW;
            case "ferry": return Maneuver.TYPE_FERRY_BOAT;
            case "arrive":
            case "waypoint": return Maneuver.TYPE_DESTINATION;
            default: return Maneuver.TYPE_UNKNOWN;
        }
    }
}
