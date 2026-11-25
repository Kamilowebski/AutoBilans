package pl.autobilans.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class DashboardWidget extends AppWidgetProvider {
    static final String OPEN_TANK = "pl.autobilans.app.WIDGET_TANK";
    static final String OPEN_EXPENSE = "pl.autobilans.app.WIDGET_EXPENSE";
    private static final DateTimeFormatter DATE_FORMAT =
        DateTimeFormatter.ofPattern("d MMM uuuu", Locale.forLanguageTag("pl-PL"));

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        update(context, manager, ids);
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, DashboardWidget.class));
        update(context, manager, ids);
    }

    private static void update(Context context, AppWidgetManager manager, int[] ids) {
        if (ids.length == 0) return;
        JSONObject car = selectedCar(context);
        LocalDate today = LocalDate.now();
        RemoteViews widget = new RemoteViews(context.getPackageName(), R.layout.dashboard_widget);
        widget.setTextViewText(R.id.widget_car, car == null ? "AutoBilans" : car.optString("name"));
        widget.setTextViewText(R.id.widget_deadline, car == null ? "Dodaj samochód" : deadlineLabel(car, today));
        widget.setOnClickPendingIntent(R.id.widget_deadline, open(context, DeadlineReminders.OPEN_DEADLINES));
        widget.setOnClickPendingIntent(R.id.widget_tank, open(context, OPEN_TANK));
        widget.setOnClickPendingIntent(R.id.widget_expense, open(context, OPEN_EXPENSE));
        manager.updateAppWidget(ids, widget);
    }

    private static JSONObject selectedCar(Context context) {
        try {
            String json = context.getSharedPreferences("autobilans", Context.MODE_PRIVATE).getString("data", "{}");
            return selectedCar(new JSONObject(json));
        } catch (JSONException ex) {
            return null;
        }
    }

    static JSONObject selectedCar(JSONObject records) {
        JSONArray cars = records.optJSONArray("cars");
        String active = records.optString("active");
        for (int i = 0; cars != null && i < cars.length(); i++) {
            JSONObject car = cars.optJSONObject(i);
            if (car != null && !active.isEmpty() && active.equals(car.optString("id"))) return car;
        }
        return null;
    }

    static String deadlineLabel(JSONObject car, LocalDate today) {
        Deadline best = choose(null, "Przegląd", car.optString("inspection"), today);
        best = choose(best, "OC", car.optString("insurance"), today);
        JSONArray service = car.optJSONArray("service");
        for (int i = 0; service != null && i < service.length(); i++) {
            JSONObject item = service.optJSONObject(i);
            if (item != null) best = choose(best, item.optString("name"), item.optString("date"), today);
        }
        if (best == null) return "Brak terminów z datą";
        String date = best.date.equals(today) ? "Dzisiaj" : best.date.format(DATE_FORMAT);
        return date + " · " + best.name + (best.date.isBefore(today) ? " (po terminie)" : "");
    }

    private static Deadline choose(Deadline best, String name, String value, LocalDate today) {
        try {
            LocalDate date = LocalDate.parse(value);
            if (best == null || (date.isBefore(today)
                    ? best.date.isBefore(today) && date.isAfter(best.date)
                    : best.date.isBefore(today) || date.isBefore(best.date))) {
                return new Deadline(name, date);
            }
        } catch (DateTimeParseException ignored) {
            // Reminders with only a mileage threshold have no date to display.
        }
        return best;
    }

    private static PendingIntent open(Context context, String action) {
        Intent intent = new Intent(context, MainActivity.class).setAction(action)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE);
    }

    private static final class Deadline {
        final String name;
        final LocalDate date;

        Deadline(String name, LocalDate date) {
            this.name = name;
            this.date = date;
        }
    }
}
