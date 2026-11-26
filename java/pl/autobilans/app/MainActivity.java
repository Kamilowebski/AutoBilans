package pl.autobilans.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.graphics.Bitmap;
import android.util.Base64;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import java.util.EnumMap;
import android.app.AlertDialog;
import android.app.backup.BackupManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.location.LocationManager;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.os.Bundle;
import android.provider.CalendarContract;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String HOME = "file:///android_asset/index.html";
    private static final int EXPORT = 1;
    private static final int IMPORT = 2;
    private static final int NOTIFICATION_PERMISSION = 3;
    private static final int MAX_BACKUP_BYTES = 8 * 1024 * 1024;
    private static final int STATION_PERMISSION = 4;
    private final ExecutorService stationExecutor = Executors.newSingleThreadExecutor();
    private FuelStations fuelStations;
    private String stationRequest;
    private WebView web;
    private boolean pageReady;
    private String pendingScreen;
    private SharedPreferences records;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xff101311);
        getWindow().setNavigationBarColor(0xff161c17);
        fuelStations = new FuelStations(getSystemService(LocationManager.class));
        records = getSharedPreferences("autobilans", MODE_PRIVATE);
        pendingScreen = screenFor(getIntent().getAction());
        web = new WebView(this);
        web.setBackgroundColor(0xff101311);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.setWebChromeClient(new android.webkit.WebChromeClient());
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setBlockNetworkLoads(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
                pageReady = false;
            }
            @Override public void onPageFinished(WebView view, String url) {
                pageReady = true;
                openPendingScreen();
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                String url = req.getUrl().toString();
                return !url.equals(HOME) && !url.startsWith(HOME + "#");
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        setContentView(web);
        web.loadUrl(HOME);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String screen = screenFor(intent.getAction());
        if (screen != null) {
            pendingScreen = screen;
            openPendingScreen();
        }
    }

    private static String screenFor(String action) {
        if (DeadlineReminders.OPEN_DEADLINES.equals(action)) return "dates";
        if (DashboardWidget.OPEN_TANK.equals(action)) return "tank";
        if (DashboardWidget.OPEN_EXPENSE.equals(action)) return "expense";
        return null;
    }

    private void openPendingScreen() {
        if (!pageReady || pendingScreen == null) return;
        String screen = pendingScreen;
        pendingScreen = null;
        web.evaluateJavascript("window.openShortcut(" + JSONObject.quote(screen) + ")", null);
    }

    @Override protected void onResume() {
        super.onResume();
        updateReminders();
        DashboardWidget.refresh(this);
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(request, permissions, grants);
        if (request == NOTIFICATION_PERMISSION) updateReminders();
        if (request == STATION_PERMISSION && stationRequest != null) {
            if (locationGranted()) locateStation(stationRequest);
            else stationResult(stationRequest, "Brak zgody na lokalizację. Wpisz nazwę stacji ręcznie.", "[]");
        }
    }

    @Override protected void onDestroy() {
        fuelStations.cancel();
        stationExecutor.shutdownNow();
        super.onDestroy();
    }

    private boolean locationGranted() {
        return checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void locateStation(String request) {
        boolean precise = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        try {
            fuelStations.locate(precise, location -> {
                if (location == null) {
                    stationResult(request, "Brak odczytu GPS. Włącz lokalizację lub wpisz stację ręcznie.", "[]");
                    return;
                }
                stationExecutor.execute(() -> {
                    try {
                        String results = FuelStations.nearby(getAssets(), location).toString();
                        runOnUiThread(() -> stationResult(request, "", results));
                    } catch (Exception ex) {
                        runOnUiThread(() -> stationResult(request, "Wyszukiwanie stacji jest niedostępne. Wpisz stację ręcznie lub spróbuj ponownie.", "[]"));
                    }
                });
            });
        } catch (SecurityException | IllegalArgumentException ex) {
            fuelStations.cancel();
            stationResult(request, "Nie można odczytać lokalizacji. Wpisz nazwę stacji ręcznie.", "[]");
        }
    }

    private void stationResult(String request, String message, String results) {
        if (isDestroyed() || !request.equals(stationRequest)) return;
        stationRequest = null;
        web.evaluateJavascript("window.fuelStationResults(" + JSONObject.quote(request) + "," +
            JSONObject.quote(message) + "," + JSONObject.quote(results) + ")", null);
    }

    private void updateReminders() {
        DeadlineReminders.refresh(this);
        web.evaluateJavascript("window.refreshReminderStatus?.()", null);
    }

    private void notificationSettings() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 33
            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            SharedPreferences permissionState = getSharedPreferences("deadline_delivery", MODE_PRIVATE);
            if (!permissionState.getBoolean("asked", false)
                || shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                permissionState.edit().putBoolean("asked", true).apply();
                requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION);
                return;
            }
        }
        Intent settings = new Intent(manager.areNotificationsEnabled()
            ? Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS : Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())
            .putExtra(Settings.EXTRA_CHANNEL_ID, DeadlineReminders.CHANNEL);
        startActivity(settings);
    }

    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    private boolean save(String json) {
        boolean written = records.edit().putString("data", json).commit();
        if (written) {
            new BackupManager(this).dataChanged();
            DeadlineReminders.refresh(this);
            DashboardWidget.refresh(this);
        }
        return written;
    }

    private void message(String text) {
        Toast.makeText(this, text, Toast.LENGTH_LONG).show();
    }

    private void chooseDocument(boolean export) {
        Intent intent = new Intent(export ? Intent.ACTION_CREATE_DOCUMENT : Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(export ? "application/json" : "*/*");
        if (export) intent.putExtra(Intent.EXTRA_TITLE, "AutoBilans-kopia.json");
        try {
            startActivityForResult(intent, export ? EXPORT : IMPORT);
        } catch (android.content.ActivityNotFoundException ex) {
            message("Brak systemowego wyboru plików.");
        }
    }

    private String read(Uri uri) throws Exception {
        try (InputStream stream = getContentResolver().openInputStream(uri)) {
            if (stream == null) throw new IllegalStateException();
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int length;
            while ((length = stream.read(buffer)) != -1) {
                if (bytes.size() + length > MAX_BACKUP_BYTES) throw new IllegalArgumentException();
                bytes.write(buffer, 0, length);
            }
            return new String(bytes.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent intent) {
        super.onActivityResult(request, result, intent);
        if (result != RESULT_OK || intent == null || intent.getData() == null) return;
        Uri uri = intent.getData();
        if (request == EXPORT) {
            try (OutputStream stream = getContentResolver().openOutputStream(uri, "wt")) {
                if (stream == null) throw new IllegalStateException();
                stream.write(records.getString("data", "{\"cars\":[],\"expenses\":[],\"active\":null}").getBytes(StandardCharsets.UTF_8));
                message("Zapisano kopię AutoBilansu.");
            } catch (Exception ex) {
                message("Nie udało się zapisać kopii.");
            }
        } else if (request == IMPORT) {
            try {
                String json = read(uri);
                new JSONObject(json);
                web.evaluateJavascript("Boolean(window.validateBackup(" + JSONObject.quote(json) + "))", valid -> {
                    if (!"true".equals(valid)) {
                        message("Plik nie jest poprawną kopią AutoBilansu.");
                        return;
                    }
                    new AlertDialog.Builder(this)
                        .setTitle("Przywrócić kopię?")
                        .setMessage("Dane z pliku zastąpią zapisane samochody, wydatki, terminy i karty paliwowe.")
                        .setNegativeButton("Anuluj", null)
                        .setPositiveButton("Przywróć", (dialog, button) -> {
                            if (save(json)) {
                                web.reload();
                                message("Przywrócono dane.");
                            } else message("Nie udało się przywrócić danych.");
                        }).show();
                });
            } catch (Exception ex) {
                message("Nie udało się odczytać kopii.");
            }
        }
    }

    public final class Bridge {
        @JavascriptInterface public String load() { return records.getString("data", ""); }
        @JavascriptInterface public boolean store(String json) { return save(json); }
        @JavascriptInterface public boolean remindersEnabled() { return DeadlineReminders.enabled(MainActivity.this); }
        @JavascriptInterface public void reminderSettings() { runOnUiThread(() -> notificationSettings()); }
        @JavascriptInterface public String version() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (android.content.pm.PackageManager.NameNotFoundException ex) {
                return "";
            }
        }
        @JavascriptInterface public String cardCode(String format, String value) {
            if (value == null || value.isEmpty() || value.length() > 100) return "";
            int width = 800;
            int height = 220;
            try {
                BarcodeFormat type = BarcodeFormat.valueOf(format);
                if (type == BarcodeFormat.QR_CODE) {
                    width = 520;
                    height = 520;
                } else if (type != BarcodeFormat.CODE_128 && type != BarcodeFormat.EAN_13) {
                    return "";
                }
                EnumMap<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
                hints.put(EncodeHintType.MARGIN, type == BarcodeFormat.QR_CODE ? 4 : 20);
                if (type == BarcodeFormat.QR_CODE) hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
                BitMatrix matrix = new MultiFormatWriter().encode(value, type, width, height, hints);
                int[] pixels = new int[matrix.getWidth() * matrix.getHeight()];
                for (int y = 0; y < matrix.getHeight(); y++) {
                    for (int x = 0; x < matrix.getWidth(); x++) {
                        pixels[y * matrix.getWidth() + x] = matrix.get(x, y) ? 0xff000000 : 0xffffffff;
                    }
                }
                Bitmap bitmap = Bitmap.createBitmap(pixels, matrix.getWidth(), matrix.getHeight(), Bitmap.Config.ARGB_8888);
                ByteArrayOutputStream png = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, png);
                bitmap.recycle();
                return Base64.encodeToString(png.toByteArray(), Base64.NO_WRAP);
            } catch (Exception ex) {
                return "";
            }
        }
        @JavascriptInterface public void exportBackup() { runOnUiThread(() -> chooseDocument(true)); }
        @JavascriptInterface public void importBackup() { runOnUiThread(() -> chooseDocument(false)); }
        @JavascriptInterface public void fuelStationSource() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://benzynamapa.pl/api-docs/")));
                } catch (android.content.ActivityNotFoundException ex) {
                    message("Źródło danych: BenzynaMAPA.pl i OpenStreetMap (ODbL).");
                }
            });
        }
        @JavascriptInterface public void findFuelStation(String request) {
            if (request == null || !request.matches("[a-f0-9]{32}")) return;
            runOnUiThread(() -> {
                if (isDestroyed()) return;
                stationRequest = request;
                if (locationGranted()) locateStation(request);
                else requestPermissions(new String[] {Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION}, STATION_PERMISSION);
            });
        }
        @JavascriptInterface public void nearbyStations() {
            runOnUiThread(() -> {
                Intent map = new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=stacje+paliw"));
                map.setPackage("com.google.android.apps.maps");
                try {
                    startActivity(map);
                } catch (android.content.ActivityNotFoundException ex) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW,
                            Uri.parse("https://www.google.com/maps/search/?api=1&query=stacje%20paliw")));
                    } catch (android.content.ActivityNotFoundException ignored) {
                        message("Brak aplikacji do otwarcia mapy.");
                    }
                }
            });
        }
        @JavascriptInterface public void openCalendar(String title, String date) {
            runOnUiThread(() -> {
                try {
                    long start = java.time.LocalDate.parse(date).atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli();
                    Intent intent = new Intent(Intent.ACTION_INSERT, CalendarContract.Events.CONTENT_URI);
                    intent.putExtra(CalendarContract.Events.TITLE, title);
                    intent.putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, true);
                    intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start);
                    intent.putExtra(CalendarContract.EXTRA_EVENT_END_TIME, start + 86400000L);
                    startActivity(intent);
                } catch (Exception ex) {
                    message("Nie udało się otworzyć kalendarza.");
                }
            });
        }
    }
}
