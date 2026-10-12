package com.example

import android.app.Application
import android.util.Log

class GlassBalanceApp : Application() {

  override fun onCreate() {
    super.onCreate()
    Log.i("GlassBalanceApp", "GlassBalanceApp initialized")
  }
}
