package com.example

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.viewinterop.AndroidView
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

  private var webViewInstance: WebView? = null
  private var bridgeInstance: AndroidBridge? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    val bridge = AndroidBridge(this)
    bridgeInstance = bridge

    setContent {
      MyApplicationTheme {
        Box(
          modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFBAE6FD))
            .systemBarsPadding()
            .testTag("game_screen_container")
        ) {
          GlassBalanceGameScreen(
            bridge = bridge,
            onWebViewReady = { webView ->
              webViewInstance = webView
            }
          )
        }
      }
    }
  }

  override fun onResume() {
    super.onResume()
    webViewInstance?.onResume()
  }

  override fun onPause() {
    super.onPause()
    webViewInstance?.onPause()
  }

  override fun onDestroy() {
    super.onDestroy()
    bridgeInstance = null
    webViewInstance?.destroy()
    webViewInstance = null
  }
}

class AndroidBridge(
  private val context: Context
) {

  @JavascriptInterface
  fun isSensorAvailable(): Boolean {
    return false
  }

  @JavascriptInterface
  fun startSensor() {}

  @JavascriptInterface
  fun stopSensor() {}

  @JavascriptInterface
  fun getSensorData(): String {
    return """{"available":false,"active":false,"pitch":0,"roll":0}"""
  }

  @JavascriptInterface
  fun vibrate(type: String) {
    val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val effect = when (type) {
        "fall" -> VibrationEffect.createWaveform(longArrayOf(0, 80, 40, 150), -1)
        "checkpoint" -> VibrationEffect.createOneShot(45, VibrationEffect.DEFAULT_AMPLITUDE)
        "victory" -> VibrationEffect.createWaveform(longArrayOf(0, 60, 50, 90), -1)
        else -> VibrationEffect.createOneShot(20, VibrationEffect.DEFAULT_AMPLITUDE)
      }
      vibrator.vibrate(effect)
    } else {
      @Suppress("DEPRECATION")
      vibrator.vibrate(40)
    }
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun GlassBalanceGameScreen(
  bridge: AndroidBridge,
  onWebViewReady: (WebView) -> Unit
) {
  AndroidView(
    factory = { ctx ->
      WebView(ctx).apply {
        layoutParams = ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )
        // Allow WebView to use its own internal hardware compositor without forcing
        // an external hardware layer that fails on Mesa /dev/dri/rendernode in emulators
        setLayerType(View.LAYER_TYPE_NONE, null)
        setBackgroundColor(android.graphics.Color.parseColor("#BAE6FD"))

        settings.apply {
          javaScriptEnabled = true
          domStorageEnabled = true
          allowFileAccess = true
          allowContentAccess = true
          mediaPlaybackRequiresUserGesture = false
          cacheMode = WebSettings.LOAD_NO_CACHE
          useWideViewPort = true
          loadWithOverviewMode = true
        }

        addJavascriptInterface(bridge, "AndroidBridge")
        webViewClient = object : WebViewClient() {
          override fun onRenderProcessGone(view: WebView?, detail: android.webkit.RenderProcessGoneDetail?): Boolean {
            val crashed = detail?.didCrash() ?: false
            val rendererPriority = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
              detail?.rendererPriorityAtExit() ?: -1
            } else -1
            android.util.Log.e(
              "MainActivity",
              "WebView renderer process terminated (didCrash=$crashed, priority=$rendererPriority). Handling recovery gracefully."
            )
            // Detach and clean up crashed WebView
            (view?.parent as? ViewGroup)?.removeView(view)
            try {
              view?.destroy()
            } catch (t: Throwable) {
              android.util.Log.w("MainActivity", "Error destroying crashed WebView: ${t.message}")
            }
            // Return true to prevent aw_browser_terminator from killing the host application
            return true
          }
        }
        webChromeClient = object : WebChromeClient() {
          override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
            android.util.Log.d(
              "GlassGameJS",
              "${consoleMessage?.message()} [line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}]"
            )
            return true
          }
        }

        loadUrl("file:///android_asset/glass_balance_3d/index.html")
        onWebViewReady(this)
      }
    },
    modifier = Modifier
      .fillMaxSize()
      .testTag("glass_balance_webview")
  )

  DisposableEffect(Unit) {
    onDispose {
      // Cleanup handled in Activity
    }
  }
}
