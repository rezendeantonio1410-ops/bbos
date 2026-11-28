package br.com.bispocoffees.mileage;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.IBinder;
import android.os.SystemClock;
import org.json.JSONException;
import org.json.JSONObject;

public final class MileageService extends Service implements LocationListener {
    static final String STOP = "stop";
    private static final long SIGNAL_GAP_MS = 120_000;
    static boolean running;
    private TripStore store;
    private LocationManager locations;
    private Location anchor;
    private long startedElapsed;
    private static long lastFixElapsed;

    static boolean hasRecentFix() {
        return running && lastFixElapsed != 0 && SystemClock.elapsedRealtime() - lastFixElapsed <= SIGNAL_GAP_MS;
    }

    @Override public void onCreate() {
        super.onCreate();
        store = new TripStore(this);
        locations = getSystemService(LocationManager.class);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) {
            finish();
            return START_NOT_STICKY;
        }
        if (running) return START_NOT_STICKY;
        try {
            if (store.active() == null) {
                stopSelf();
                return START_NOT_STICKY;
            }
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                finish();
                return START_NOT_STICKY;
            }
            startForeground(1, notification());
            lastFixElapsed = 0;
            startedElapsed = SystemClock.elapsedRealtime();
            locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 4_000, 0, this);
            running = true;
        } catch (JSONException | RuntimeException failure) {
            finish();
        }
        return START_NOT_STICKY;
    }

    private Notification notification() {
        String channel = "mileage";
        getSystemService(NotificationManager.class).createNotificationChannel(
            new NotificationChannel(channel, "Registro de quilometragem", NotificationManager.IMPORTANCE_LOW));
        int flags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MileageActivity.class), flags);
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, MileageService.class).setAction(STOP), flags);
        return new Notification.Builder(this, channel)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("BBOS · Percurso ativo")
            .setContentText("GPS registrando a quilometragem deste percurso.")
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(new Notification.Action.Builder(null, "Encerrar percurso", stop).build())
            .build();
    }

    @Override public void onLocationChanged(Location fix) {
        long elapsed = fix.getElapsedRealtimeNanos() / 1_000_000;
        if (!running || elapsed < startedElapsed || elapsed <= lastFixElapsed
            || !fix.hasAccuracy() || fix.getAccuracy() > 25) return;
        try {
            JSONObject trip = store.active();
            if (trip == null) { stopSelf(); return; }
            long previous = lastFixElapsed == 0 ? startedElapsed : lastFixElapsed;
            if (elapsed - previous > SIGNAL_GAP_MS) {
                trip.put("incomplete", true);
                anchor = null;
            }
            lastFixElapsed = elapsed;
            trip.put("hasFix", true);
            if (anchor == null) {
                anchor = fix;
            } else {
                float meters = anchor.distanceTo(fix);
                float noise = Math.max(12, Math.max(anchor.getAccuracy(), fix.getAccuracy()));
                if (meters >= noise) {
                    double seconds = (fix.getElapsedRealtimeNanos() - anchor.getElapsedRealtimeNanos()) / 1e9;
                    if (meters / seconds <= 55) {
                        trip.put("distanceMeters", trip.getInt("distanceMeters") + Math.round(meters));
                        anchor = fix;
                    }
                }
            }
            store.update(trip);
        } catch (JSONException failure) {
            finish();
        }
    }

    @Override public void onProviderEnabled(String provider) {}

    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override public void onProviderDisabled(String provider) {
        anchor = null;
        try {
            JSONObject trip = store.active();
            if (trip != null) store.update(trip.put("hasFix", false).put("incomplete", true));
        } catch (JSONException failure) {
            finish();
        }
    }

    private void finish() {
        try {
            store.finish(System.currentTimeMillis(), lastFixElapsed == 0
                || SystemClock.elapsedRealtime() - lastFixElapsed > SIGNAL_GAP_MS);
        } catch (JSONException ignored) {
            // Keep the stored session if its summary could not be serialized.
        }
        stopSelf();
    }

    @Override public void onDestroy() {
        running = false;
        locations.removeUpdates(this);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
