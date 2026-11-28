package br.com.bispocoffees.mileage;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Collections;

public final class MileageActivity extends Activity {
    private TripStore store;
    private String error;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        store = new TripStore(this);
        try {
            if (!MileageService.running && store.active() != null) {
                store.finish(System.currentTimeMillis(), true);
            }
        } catch (JSONException failure) {
            error = "Não foi possível recuperar o último percurso.";
        }

        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            TextView message = new TextView(this);
            message.setText("Atualize o Android System WebView para abrir a quilometragem do BBOS.");
            setContentView(message);
            return;
        }
        WebView web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                android.net.Uri url = request.getUrl();
                return !BuildConfig.WEB_ORIGIN.equals(url.getScheme() + "://" + url.getEncodedAuthority());
            }
        });
        WebViewCompat.addWebMessageListener(web, "BBOSMileage", Collections.singleton(BuildConfig.WEB_ORIGIN),
            (view, message, sourceOrigin, isMainFrame, reply) -> {
                if (!isMainFrame) return;
                try {
                    JSONObject input = new JSONObject(message.getData());
                    String owner = input.optString("owner");
                    switch (input.optString("action")) {
                        case "start": startTrip(owner, input.optString("vehicle").trim()); break;
                        case "stop": stopTrip(owner); break;
                        case "ack": store.acknowledge(input.optString("id"), owner); break;
                        case "status": break;
                        default: return;
                    }
                    reply.postMessage(store.state(owner).put("error", error).toString());
                } catch (JSONException | RuntimeException failure) {
                    reply.postMessage("{\"pending\":[],\"error\":\"Não foi possível acessar o registro no aparelho.\"}");
                }
            });
        FrameLayout layout = new FrameLayout(this);
        layout.addView(web, new FrameLayout.LayoutParams(-1, -1));
        if (Build.VERSION.SDK_INT >= 35) {
            layout.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        }
        setContentView(layout);
        web.loadUrl(BuildConfig.WEB_ORIGIN + "/quilometragem");
    }

    private void startTrip(String owner, String vehicle) throws JSONException {
        if (owner.isEmpty() || vehicle.isEmpty() || vehicle.length() > 80 || store.active() != null) return;
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            error = "Permita a localização precisa e toque em Iniciar percurso novamente.";
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 1);
            return;
        }
        if (Build.VERSION.SDK_INT >= 33
            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            error = "Permita as notificações para poder encerrar o GPS com o app em segundo plano.";
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 2);
            return;
        }
        if (!getSystemService(LocationManager.class).isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            error = "Ative a localização do aparelho antes de iniciar o percurso.";
            return;
        }
        store.start(owner, vehicle);
        try {
            startForegroundService(new Intent(this, MileageService.class));
            error = null;
        } catch (RuntimeException failure) {
            store.finish(System.currentTimeMillis(), true);
            error = "O Android não conseguiu iniciar o GPS.";
        }
    }

    private void stopTrip(String owner) throws JSONException {
        JSONObject active = store.active();
        if (active == null || !owner.equals(active.optString("owner"))) return;
        startService(new Intent(this, MileageService.class).setAction(MileageService.STOP));
    }
}
