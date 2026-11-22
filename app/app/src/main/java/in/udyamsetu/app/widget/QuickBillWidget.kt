// UdyamSetu — Home widget (APK-only feature: the Site cannot do this).
// Classic AppWidgetProvider + RemoteViews, no extra dependency.
// One tap opens the app straight into New Bill.
package `in`.udyamsetu.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import `in`.udyamsetu.app.R
import `in`.udyamsetu.app.ui.MainActivity

class QuickBillWidget : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        for (id in appWidgetIds) {
            val intent = Intent(context, MainActivity::class.java).apply {
                putExtra("udyamsetu.route", "billing")
            }
            val pending = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val views = RemoteViews(context.packageName, R.layout.widget_quick_bill)
            views.setOnClickPendingIntent(R.id.widget_button, pending)
            appWidgetManager.updateAppWidget(id, views)
        }
    }
}
