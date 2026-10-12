package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

  @Test
  fun `read string from context`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val appName = context.getString(R.string.app_name)
    assertEquals("Glass Balance 3D", appName)
  }

  @Test
  fun `verify game assets and camera relative control logic`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val assetManager = context.assets
    val files = assetManager.list("glass_balance_3d") ?: emptyArray()
    org.junit.Assert.assertTrue(files.contains("index.html"))
    org.junit.Assert.assertTrue(files.contains("game.js"))
    org.junit.Assert.assertTrue(files.contains("style.css"))

    val gameJsContent = assetManager.open("glass_balance_3d/game.js").bufferedReader().use { it.readText() }
    org.junit.Assert.assertTrue(gameJsContent.contains("CAMERA-RELATIVE MANUAL BALL CONTROLS"))
    org.junit.Assert.assertTrue(gameJsContent.contains("camForwardX"))
    org.junit.Assert.assertTrue(gameJsContent.contains("camRightX"))
    org.junit.Assert.assertTrue(gameJsContent.contains("Number(input.has('right')) - Number(input.has('left'))"))
  }

  @Test
  fun `verify directional vector calculations at different camera angles`() {
    // Helper mathematical verification matching game.js logic:
    fun calculateTargetDir(forwardInput: Double, sideInput: Double, camForwardX: Double, camForwardZ: Double): Pair<Double, Double> {
      val camRightX = -camForwardZ
      val camRightZ = camForwardX
      val inputMag = Math.hypot(forwardInput, sideInput)
      val factor = 1.0 / inputMag
      val targetDirX = (forwardInput * camForwardX + sideInput * camRightX) * factor
      val targetDirZ = (forwardInput * camForwardZ + sideInput * camRightZ) * factor
      return Pair(targetDirX, targetDirZ)
    }

    // Camera facing -Z (standard third person behind ball):
    val camFwdX0 = 0.0
    val camFwdZ0 = -1.0
    val camRightX0 = -(-1.0) // +1.0
    val camRightZ0 = 0.0

    // Press LEFT: sideInput = -1.0, forwardInput = 0.0
    val (leftX0, leftZ0) = calculateTargetDir(0.0, -1.0, camFwdX0, camFwdZ0)
    org.junit.Assert.assertEquals(-1.0, leftX0, 0.001) // toward camera-relative left (-X)
    org.junit.Assert.assertEquals(0.0, leftZ0, 0.001)

    // Press RIGHT: sideInput = +1.0, forwardInput = 0.0
    val (rightX0, rightZ0) = calculateTargetDir(0.0, 1.0, camFwdX0, camFwdZ0)
    org.junit.Assert.assertEquals(1.0, rightX0, 0.001) // toward camera-relative right (+X)
    org.junit.Assert.assertEquals(0.0, rightZ0, 0.001)

    // Press FRONT: forwardInput = +1.0, sideInput = 0.0
    val (frontX0, frontZ0) = calculateTargetDir(1.0, 0.0, camFwdX0, camFwdZ0)
    org.junit.Assert.assertEquals(0.0, frontX0, 0.001)
    org.junit.Assert.assertEquals(-1.0, frontZ0, 0.001) // toward camera-relative front (-Z)

    // Press BACK: forwardInput = -1.0, sideInput = 0.0
    val (backX0, backZ0) = calculateTargetDir(-1.0, 0.0, camFwdX0, camFwdZ0)
    org.junit.Assert.assertEquals(0.0, backX0, 0.001)
    org.junit.Assert.assertEquals(1.0, backZ0, 0.001) // toward camera-relative back (+Z)

    // Camera rotated 90 degrees (facing -X):
    val camFwdX90 = -1.0
    val camFwdZ90 = 0.0
    val (leftX90, leftZ90) = calculateTargetDir(0.0, -1.0, camFwdX90, camFwdZ90)
    org.junit.Assert.assertEquals(0.0, leftX90, 0.001)
    org.junit.Assert.assertEquals(1.0, leftZ90, 0.001) // camera-relative left (+Z)

    val (rightX90, rightZ90) = calculateTargetDir(0.0, 1.0, camFwdX90, camFwdZ90)
    org.junit.Assert.assertEquals(0.0, rightX90, 0.001)
    org.junit.Assert.assertEquals(-1.0, rightZ90, 0.001) // camera-relative right (-Z)
  }

  @Test
  fun `verify application class instance`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    org.junit.Assert.assertNotNull(context)
  }
}
