package io.github.miguelav33.minimapa.car;

import android.annotation.SuppressLint;
import android.app.Presentation;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.util.Log;
import android.view.Surface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;
import androidx.car.app.AppManager;
import androidx.car.app.CarContext;
import androidx.car.app.SurfaceCallback;
import androidx.car.app.SurfaceContainer;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

/**
 * Dibuja el mapa en la pantalla del coche. Usa una página web propia (car.html, con las mismas
 * skins que el móvil) dentro de una Presentation sobre la superficie que nos da Android Auto.
 * Si el WebView fallase, dibuja un panel sencillo con velocidad y avisos.
 */
public class CarMapRenderer implements SurfaceCallback, CarState.Listener {

    private static final String TAG = "MinimapaCar";
    private static final String CAR_URL = "https://appassets.androidplatform.net/assets/public/car.html";

    private final CarContext ctx;
    private VirtualDisplay display;
    private Presentation presentation;
    private WebView web;
    private Surface surface;
    private boolean pageReady;
    private boolean fallback;
    private int width, height, dpi;
    private Rect visible;
    private boolean panMode;

    public CarMapRenderer(@NonNull CarContext ctx) {
        this.ctx = ctx;
        ctx.getCarService(AppManager.class).setSurfaceCallback(this);
        CarState.get().addListener(this);
    }

    // ---------------------------------------------------------------- Superficie

    @Override
    public void onSurfaceAvailable(@NonNull SurfaceContainer sc) {
        releaseSurface();
        surface = sc.getSurface();
        if (surface == null) return;
        width = sc.getWidth();
        height = sc.getHeight();
        dpi = sc.getDpi();
        try {
            DisplayManager dm = (DisplayManager) ctx.getSystemService(Context.DISPLAY_SERVICE);
            display = dm.createVirtualDisplay("MinimapaCar", width, height, dpi, surface,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY);
            presentation = new Presentation(ctx, display.getDisplay());
            web = createWebView(presentation.getContext());
            presentation.setContentView(web);
            presentation.show();
            web.loadUrl(CAR_URL);
            fallback = false;
        } catch (Throwable t) {
            Log.e(TAG, "No se pudo crear el mapa web en el coche, uso el panel simple", t);
            releasePresentation();
            fallback = true;
            drawFallback();
        }
    }

    @Override
    public void onSurfaceDestroyed(@NonNull SurfaceContainer sc) {
        releaseSurface();
    }

    @Override
    public void onVisibleAreaChanged(@NonNull Rect visibleArea) {
        visible = new Rect(visibleArea);
        pushArea();
    }

    @Override
    public void onStableAreaChanged(@NonNull Rect stableArea) {
        if (visible == null) {
            visible = new Rect(stableArea);
            pushArea();
        }
    }

    @Override
    public void onScroll(float distanceX, float distanceY) {
        js(String.format(Locale.US, "window.carGesture&&carGesture('scroll',%f,%f)", distanceX, distanceY));
    }

    @Override
    public void onFling(float velocityX, float velocityY) {
        js(String.format(Locale.US, "window.carGesture&&carGesture('fling',%f,%f)", velocityX, velocityY));
    }

    @Override
    public void onScale(float focusX, float focusY, float scaleFactor) {
        js(String.format(Locale.US, "window.carGesture&&carGesture('scale',%f,%f,%f)", focusX, focusY, scaleFactor));
    }

    @Override
    public void onClick(float x, float y) {
        js(String.format(Locale.US, "window.carGesture&&carGesture('click',%f,%f)", x, y));
    }

    /** Botones del mapa: zoomIn, zoomOut, recenter. */
    public void action(String name) {
        js("window.carAction&&carAction('" + name + "')");
    }

    public void setPanMode(boolean on) {
        panMode = on;
        js("window.carAction&&carAction('pan'," + on + ")");
    }

    // ---------------------------------------------------------------- Datos

    @Override
    public void onCarStateChanged(String what) {
        if (fallback) {
            if ("live".equals(what) || "brain".equals(what)) drawFallback();
            return;
        }
        if (!pageReady) return;
        CarState s = CarState.get();
        switch (what) {
            case "live":
                if (s.liveJson() != null) js("window.carUpdate&&carUpdate(" + s.liveJson() + ")");
                break;
            case "route":
                js("window.carSetRoute&&carSetRoute(" + orNull(s.routeJson()) + ")");
                break;
            case "radars":
                if (s.radarsJson() != null) js("window.carSetRadars&&carSetRadars(" + s.radarsJson() + ")");
                break;
            case "settings":
                if (s.settingsJson() != null) js("window.carSetSettings&&carSetSettings(" + s.settingsJson() + ")");
                break;
            case "brain":
                js("window.carBrain&&carBrain(" + s.brainAlive() + ")");
                break;
            default:
                break;
        }
    }

    private void pushAll() {
        CarState s = CarState.get();
        pushArea();
        if (s.settingsJson() != null) js("window.carSetSettings&&carSetSettings(" + s.settingsJson() + ")");
        if (s.radarsJson() != null) js("window.carSetRadars&&carSetRadars(" + s.radarsJson() + ")");
        js("window.carSetRoute&&carSetRoute(" + orNull(s.routeJson()) + ")");
        if (s.liveJson() != null) js("window.carUpdate&&carUpdate(" + s.liveJson() + ")");
        js("window.carBrain&&carBrain(" + s.brainAlive() + ")");
    }

    private void pushArea() {
        if (!pageReady || visible == null) return;
        js(String.format(Locale.US, "window.carSetArea&&carSetArea({left:%d,top:%d,right:%d,bottom:%d,width:%d,height:%d,dpi:%d})",
                visible.left, visible.top, visible.right, visible.bottom, width, height, dpi));
    }

    private static String orNull(String json) {
        return json == null ? "null" : json;
    }

    private void js(String code) {
        WebView w = web;
        if (w == null || !pageReady) return;
        try {
            w.evaluateJavascript(code, null);
        } catch (Throwable t) {
            Log.w(TAG, "evaluateJavascript", t);
        }
    }

    // ---------------------------------------------------------------- WebView

    @SuppressLint("SetJavaScriptEnabled")
    private WebView createWebView(Context context) {
        WebView w = new WebView(context);
        WebSettings st = w.getSettings();
        st.setJavaScriptEnabled(true);
        st.setDomStorageEnabled(true);
        st.setMediaPlaybackRequiresUserGesture(false);
        st.setAllowFileAccess(false);
        w.setBackgroundColor(Color.rgb(11, 13, 12));
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new AssetsHandler(context))
                .build();
        w.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                pushAll();
            }
        });
        return w;
    }

    /** Sirve los ficheros de la app con el tipo MIME correcto (los módulos .mjs lo necesitan). */
    static final class AssetsHandler implements WebViewAssetLoader.PathHandler {
        private final Context context;

        AssetsHandler(Context context) {
            this.context = context.getApplicationContext();
        }

        @Override
        public WebResourceResponse handle(@NonNull String path) {
            try {
                InputStream in = context.getAssets().open(path);
                return new WebResourceResponse(mime(path), mime(path).startsWith("text/") ? "utf-8" : null, in);
            } catch (IOException e) {
                return null;
            }
        }

        static String mime(String path) {
            String p = path.toLowerCase(Locale.ROOT);
            if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript";
            if (p.endsWith(".css")) return "text/css";
            if (p.endsWith(".html")) return "text/html";
            if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
            if (p.endsWith(".png")) return "image/png";
            if (p.endsWith(".svg")) return "image/svg+xml";
            if (p.endsWith(".woff2")) return "font/woff2";
            return "application/octet-stream";
        }
    }

    // ---------------------------------------------------------------- Panel simple (respaldo)

    private void drawFallback() {
        Surface sf = surface;
        if (sf == null || !sf.isValid()) return;
        Canvas c = null;
        try {
            c = sf.lockCanvas(null);
            c.drawColor(Color.rgb(20, 24, 22));
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            p.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            int left = visible != null ? visible.left + 24 : 24;
            int bottom = visible != null ? visible.bottom - 24 : height - 24;
            JSONObject live = null;
            try {
                if (CarState.get().liveJson() != null) live = new JSONObject(CarState.get().liveJson());
            } catch (Exception ignored) {
                live = null;
            }
            p.setColor(Color.WHITE);
            if (live == null || !CarState.get().brainAlive()) {
                p.setTextSize(height / 14f);
                c.drawText("Abre Minimapa en el móvil", left, height / 2f, p);
                return;
            }
            int kmh = (int) Math.round(live.optDouble("speed", 0) * 3.6);
            p.setTextSize(height / 5f);
            c.drawText(String.valueOf(kmh), left, bottom - height / 12f, p);
            p.setTextSize(height / 20f);
            p.setColor(Color.LTGRAY);
            c.drawText("km/h", left, bottom, p);
            int limit = live.optInt("limit", 0);
            if (limit > 0) {
                float r = height / 11f, cx = left + height / 3.2f + r, cy = bottom - height / 6f;
                p.setColor(Color.rgb(211, 47, 47));
                c.drawCircle(cx, cy, r, p);
                p.setColor(Color.WHITE);
                c.drawCircle(cx, cy, r * 0.78f, p);
                p.setColor(Color.BLACK);
                p.setTextSize(r * 0.9f);
                p.setTextAlign(Paint.Align.CENTER);
                c.drawText(String.valueOf(limit), cx, cy + r * 0.32f, p);
                p.setTextAlign(Paint.Align.LEFT);
            }
            JSONObject alert = live.optJSONObject("alert");
            if (alert != null) {
                p.setColor(Color.rgb(198, 40, 40));
                int right = visible != null ? visible.right - 24 : width - 24;
                int top = visible != null ? visible.top + 24 : 24;
                c.drawRect(right - width / 3f, top, right, top + height / 4f, p);
                p.setColor(Color.WHITE);
                p.setTextSize(height / 18f);
                c.drawText(alert.optString("label", "Radar"), right - width / 3f + 16, top + height / 12f, p);
                p.setTextSize(height / 10f);
                c.drawText(alert.optString("dist", ""), right - width / 3f + 16, top + height / 4f - 20, p);
            }
        } catch (Throwable t) {
            Log.w(TAG, "drawFallback", t);
        } finally {
            if (c != null) {
                try {
                    sf.unlockCanvasAndPost(c);
                } catch (Throwable ignored) {
                    // superficie liberada
                }
            }
        }
    }

    // ---------------------------------------------------------------- Limpieza

    private void releasePresentation() {
        pageReady = false;
        if (presentation != null) {
            try {
                presentation.dismiss();
            } catch (Throwable ignored) {
                // ya cerrada
            }
            presentation = null;
        }
        if (web != null) {
            try {
                web.destroy();
            } catch (Throwable ignored) {
                // ya destruido
            }
            web = null;
        }
        if (display != null) {
            display.release();
            display = null;
        }
    }

    private void releaseSurface() {
        releasePresentation();
        surface = null;
    }

    public void release() {
        CarState.get().removeListener(this);
        releaseSurface();
    }

    public boolean isPanMode() {
        return panMode;
    }
}
