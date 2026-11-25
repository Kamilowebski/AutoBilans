package pl.autobilans.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;

public final class DeadlineReminders extends BroadcastReceiver {
    static final String CHANNEL = "deadlines";
    static final String OPEN_DEADLINES = "pl.autobilans.app.OPEN_DEADLINES";
    private static final String CHECK = "pl.autobilans.app.CHECK_DEADLINES";
    private static final DateTimeFormatter DISPLAY_DATE =
        DateTimeFormatter.ofPattern("d MMMM yyyy", new Locale("pl", "PL"));
    private static final int[] DAYS_BEFORE = {7, 1, 0};
    private static final String[] TYPES = {"inspection", "insurance"};

    @Override public void onReceive(Context context, Intent intent) {
        refresh(context);
    }

    static void createChannel(Context context) {
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Terminy",
            NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("Przypomnienia o przeglądzie technicznym, końcu OC i serwisie.");
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    static boolean enabled(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = manager.getNotificationChannel(CHANNEL);
        return manager.areNotificationsEnabled()
            && channel != null && channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }

    static ZonedDateTime reminderTime(LocalDate deadline, int daysBefore, ZoneId zone) {
        return deadline.minusDays(daysBefore).atTime(9, 0).atZone(zone);
    }

    static synchronized void refresh(Context context) {
        createChannel(context);
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        Intent check = new Intent(context, DeadlineReminders.class).setAction(CHECK);
        PendingIntent pending = PendingIntent.getBroadcast(context, 0, check, PendingIntent.FLAG_IMMUTABLE);
        ZonedDateTime now = ZonedDateTime.now();
        LocalDate today = now.toLocalDate();
        long next = Long.MAX_VALUE;
        SharedPreferences seen = context.getSharedPreferences("deadline_delivery", Context.MODE_PRIVATE);
        Set<String> delivered = today.toString().equals(seen.getString("day", ""))
            ? new HashSet<>(seen.getStringSet("keys", new HashSet<>())) : new HashSet<>();
        final boolean canNotify = enabled(context);
        SharedPreferences records = context.getSharedPreferences("autobilans", Context.MODE_PRIVATE);
        Set<String> mileageDelivered = new HashSet<>(seen.getStringSet("mileage", new HashSet<>()));
        Set<String> reached = new HashSet<>();
        try {
            JSONObject data = new JSONObject(records.getString("data", "{}"));
            JSONArray cars = data.optJSONArray("cars");
            Map<String, Integer> mileage = new HashMap<>();
            collectMileage(data.optJSONArray("expenses"), mileage);
            collectMileage(data.optJSONArray("skippedTanks"), mileage);
            for (int index = 0; cars != null && index < cars.length(); index++) {
                JSONObject car = cars.optJSONObject(index);
                if (car == null) continue;
                String carId = car.optString("id");
                String carName = car.optString("name");
                for (String type : TYPES) {
                    String title = type.equals("inspection") ? "Przegląd techniczny" : "Koniec OC";
                    next = Math.min(next, checkDate(context, carId + ":" + type, carName, title,
                        car.optString(type), now, canNotify, delivered));
                }
                int odometer = Math.max(car.optInt("odometer", -1), mileage.getOrDefault(carId, -1));
                JSONArray service = car.optJSONArray("service");
                for (int j = 0; service != null && j < service.length(); j++) {
                    JSONObject reminder = service.optJSONObject(j);
                    if (reminder == null) continue;
                    String key = carId + ":service:" + reminder.optString("id");
                    String title = reminder.optString("name");
                    next = Math.min(next, checkDate(context, key, carName, title,
                        reminder.optString("date"), now, canNotify, delivered));
                    int target = reminder.optInt("odometer", -1);
                    if (target >= 0 && odometer >= target) {
                        String mileageKey = key + ":km:" + target;
                        if (mileageDelivered.contains(mileageKey) || canNotify) {
                            reached.add(mileageKey);
                            if (!mileageDelivered.contains(mileageKey)) {
                                notify(context, mileageKey, title, carName + " · Osiągnięto limit " + target + " km");
                            }
                        }
                    }
                }
            }
        } catch (JSONException ex) {
            android.util.Log.w("AutoBilans", "Nie można odczytać terminów", ex);
        }
        seen.edit().putString("day", today.toString()).putStringSet("keys", delivered)
            .putStringSet("mileage", reached).apply();
        if (next == Long.MAX_VALUE) alarms.cancel(pending);
        else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pending);
    }

    private static void collectMileage(JSONArray entries, Map<String, Integer> mileage) {
        for (int i = 0; entries != null && i < entries.length(); i++) {
            JSONObject item = entries.optJSONObject(i);
            if (item == null) continue;
            int reading = item.optInt("odometer", -1);
            if (reading >= 0) mileage.merge(item.optString("car"), reading, Math::max);
        }
    }

    private static long checkDate(Context context, String key, String car, String title, String date,
                                  ZonedDateTime now, boolean canNotify, Set<String> delivered) {
        LocalDate deadline;
        try {
            deadline = LocalDate.parse(date);
        } catch (DateTimeParseException ex) {
            return Long.MAX_VALUE;
        }
        long next = Long.MAX_VALUE;
        for (int daysBefore : DAYS_BEFORE) {
            ZonedDateTime due = reminderTime(deadline, daysBefore, now.getZone());
            if (due.isAfter(now)) {
                next = Math.min(next, due.toInstant().toEpochMilli());
            } else if (canNotify && due.toLocalDate().equals(now.toLocalDate())) {
                String deliveryKey = key + ":" + deadline + ":" + daysBefore;
                if (delivered.add(deliveryKey)) {
                    String when = daysBefore == 0 ? "Dzisiaj" : daysBefore == 1 ? "Jutro" : "Za 7 dni";
                    notify(context, deliveryKey, title, car + " · " + when + ", " + deadline.format(DISPLAY_DATE));
                }
            }
        }
        return next;
    }

    private static void notify(Context context, String key, String title, String text) {
        Intent open = new Intent(context, MainActivity.class).setAction(OPEN_DEADLINES)
            .setData(new Uri.Builder().scheme("autobilans").authority("terminy").appendPath(key).build())
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE);
        int icon = context.getResources().getIdentifier("ic_deadline", "drawable", context.getPackageName());
        Notification notification = new Notification.Builder(context, CHANNEL)
            .setSmallIcon(icon).setContentTitle(title).setContentText(text)
            .setStyle(new Notification.BigTextStyle().bigText(text)).setContentIntent(content)
            .setCategory(Notification.CATEGORY_REMINDER).setAutoCancel(true).build();
        try {
            context.getSystemService(NotificationManager.class).notify(key, 1, notification);
        } catch (SecurityException ex) {
            android.util.Log.w("AutoBilans", "Brak uprawnienia do powiadomień", ex);
        }
    }
}
