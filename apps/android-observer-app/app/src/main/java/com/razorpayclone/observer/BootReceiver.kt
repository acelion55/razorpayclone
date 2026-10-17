package com.razorpayclone.observer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * BroadcastReceiver that triggers upon device boot (RECEIVE_BOOT_COMPLETED).
 * Automatically restarts the Razorpay Clone Observer service and heartbeat scheduler.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED || intent?.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            Log.i("RazorpayCloneBootReceiver", "Device boot detected. Restarting Razorpay Clone Payment Observer...")
            context?.let { ctx ->
                val apiClient = ApiClient(ctx)
                if (apiClient.isPaired()) {
                    val scheduler = HeartbeatScheduler(ctx)
                    scheduler.start()
                    Log.i("RazorpayCloneBootReceiver", "Razorpay Clone Payment Observer successfully re-armed on boot.")
                }
            }
        }
    }
}
