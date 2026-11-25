package pl.autobilans.app;

import android.annotation.SuppressLint;
import android.content.res.AssetManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

final class FuelStations {
    interface PositionResult { void accept(Location location); }
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final LocationManager locations;
    private LocationListener listener;
    private Runnable timeout;

    FuelStations(LocationManager locations) { this.locations = locations; }

    @SuppressLint("MissingPermission")
    void locate(boolean precise, PositionResult callback) {
        cancel();
        List<String> providers = new ArrayList<>();
        for (String provider : locations.getProviders(true)) {
            if (LocationManager.NETWORK_PROVIDER.equals(provider) ||
                (precise && LocationManager.GPS_PROVIDER.equals(provider))) providers.add(provider);
        }
        Location best = null;
        for (String provider : providers) {
            Location recent = locations.getLastKnownLocation(provider);
            if (recent == null || SystemClock.elapsedRealtimeNanos() - recent.getElapsedRealtimeNanos() > 60000000000L) continue;
            if (best == null || recent.getAccuracy() < best.getAccuracy()) best = recent;
        }
        if (best != null && (!precise || best.getAccuracy() <= 200)) {
            callback.accept(best);
            return;
        }
        final Location[] fallback = {best};
        listener = location -> {
            if (precise && location.getAccuracy() > 200 && providers.contains(LocationManager.GPS_PROVIDER)) {
                if (fallback[0] == null || location.getAccuracy() < fallback[0].getAccuracy()) fallback[0] = location;
                return;
            }
            cancel();
            callback.accept(location);
        };
        if (providers.isEmpty()) {
            cancel();
            callback.accept(null);
            return;
        }
        for (String provider : providers) locations.requestLocationUpdates(provider, 0, 0, listener, Looper.getMainLooper());
        timeout = () -> {
            cancel();
            callback.accept(fallback[0]);
        };
        handler.postDelayed(timeout, 12000);
    }

    void cancel() {
        if (listener != null) locations.removeUpdates(listener);
        if (timeout != null) handler.removeCallbacks(timeout);
        listener = null;
        timeout = null;
    }

    static JSONArray nearby(AssetManager assets, Location location) throws Exception {
        int radius = Math.min(8000, Math.max(2000, (int) location.getAccuracy() * 2));
        try (InputStream stream = assets.open("fuel-stations-pl.json")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            for (int count; (count = stream.read(chunk)) != -1;) bytes.write(chunk, 0, count);
            JSONArray stations = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8))
                .getJSONArray("stations");
            List<JSONObject> matches = new ArrayList<>();
            float[] distance = new float[1];
            for (int i = 0; i < stations.length(); i++) {
                JSONObject station = stations.getJSONObject(i);
                double lat = station.optDouble("lat");
                double lon = station.optDouble("lng");
                if (!Double.isFinite(lat) || !Double.isFinite(lon)
                    || Math.abs(location.getLatitude() - lat) > 0.1
                    || Math.abs(location.getLongitude() - lon) > 0.2) continue;
                String name = station.optString("name").trim();
                if (name.isEmpty()) name = station.optString("brand").trim();
                if (name.isEmpty() || name.toLowerCase(java.util.Locale.ROOT).contains("zamknięt")) continue;
                Location.distanceBetween(location.getLatitude(), location.getLongitude(), lat, lon, distance);
                if (distance[0] > radius) continue;
                String address = station.optString("address").trim();
                if (address.isEmpty()) address = station.optString("city").trim();
                matches.add(new JSONObject().put("name", name).put("address", address)
                    .put("meters", Math.round(distance[0])));
            }
            matches.sort(Comparator.comparingInt(item -> item.optInt("meters")));
            JSONArray results = new JSONArray();
            for (int i = 0; i < Math.min(5, matches.size()); i++) results.put(matches.get(i));
            return results;
        }
    }
}
