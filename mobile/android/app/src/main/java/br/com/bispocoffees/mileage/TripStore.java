package br.com.bispocoffees.mileage;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.UUID;

// Called on the Android main thread by the activity and service.
final class TripStore {
    private final SharedPreferences prefs;

    TripStore(Context context) {
        prefs = context.getSharedPreferences("mileage", Context.MODE_PRIVATE);
    }

    JSONObject active() throws JSONException {
        String value = prefs.getString("active", null);
        return value == null ? null : new JSONObject(value);
    }

    void start(String owner, String vehicle) throws JSONException {
        if (active() != null) return;
        JSONObject trip = new JSONObject()
            .put("id", UUID.randomUUID().toString())
            .put("owner", owner)
            .put("vehicle", vehicle)
            .put("startedAt", System.currentTimeMillis())
            .put("distanceMeters", 0)
            .put("incomplete", false);
        update(trip);
    }

    void update(JSONObject trip) {
        prefs.edit().putString("active", trip.toString()).apply();
    }

    void finish(long endedAt, boolean incomplete) throws JSONException {
        JSONObject trip = active();
        if (trip == null) return;
        trip.put("endedAt", Math.max(endedAt, trip.getLong("startedAt")));
        trip.put("incomplete", incomplete || trip.optBoolean("incomplete"));
        prefs.edit().putString("pending:" + trip.getString("id"), trip.toString())
            .remove("active").apply();
    }

    void acknowledge(String id, String owner) throws JSONException {
        String key = "pending:" + id;
        String saved = prefs.getString(key, null);
        if (saved != null && new JSONObject(saved).getString("owner").equals(owner)) {
            prefs.edit().remove(key).apply();
        }
    }

    JSONObject state(String owner) throws JSONException {
        JSONArray pending = new JSONArray();
        for (String key : prefs.getAll().keySet()) {
            if (!key.startsWith("pending:")) continue;
            JSONObject trip = new JSONObject(prefs.getString(key, ""));
            if (owner.equals(trip.getString("owner"))) pending.put(trip);
        }
        JSONObject trip = active();
        if (trip != null) {
            if (!owner.equals(trip.getString("owner"))) {
                trip = new JSONObject().put("owner", JSONObject.NULL);
            } else {
                trip.put("hasFix", MileageService.hasRecentFix() && trip.optBoolean("hasFix"));
            }
        }
        return new JSONObject().put("active", trip).put("pending", pending);
    }
}
