package expo.modules.pdfkasestampcleanup

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class PdfKaseStampCleanupModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PdfKaseStampCleanup")

    AsyncFunction("removeBackground") { sourceUri: String, _: Map<String, Any?>? ->
      val context =
        appContext.reactContext ?: throw IllegalStateException("React context hazır değil.")

      val sourceBitmap = decodeBitmap(context, sourceUri)

      try {
        val (cleanedBitmap, removedPixels) = removeBackgroundHeuristic(sourceBitmap)

        try {
          val outputFile = File(
            context.cacheDir,
            "stamp-cleanup-${System.currentTimeMillis()}.png",
          )

          FileOutputStream(outputFile).use { stream ->
            val written = cleanedBitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)

            if (!written) {
              throw IllegalStateException("PNG çıktı dosyası yazılamadı.")
            }
          }

          mapOf(
            "cleanedUri" to Uri.fromFile(outputFile).toString(),
            "backgroundRemoved" to (removedPixels > removalThreshold(cleanedBitmap.width, cleanedBitmap.height)),
            "provider" to "native-android-heuristic",
          )
        } finally {
          if (cleanedBitmap !== sourceBitmap && !cleanedBitmap.isRecycled) {
            cleanedBitmap.recycle()
          }
        }
      } finally {
        if (!sourceBitmap.isRecycled) {
          sourceBitmap.recycle()
        }
      }
    }
  }

  private data class RgbColor(
    val r: Int,
    val g: Int,
    val b: Int,
  )

  private fun decodeBitmap(context: Context, sourceUri: String): Bitmap {
    val trimmed = sourceUri.trim()

    if (trimmed.isEmpty()) {
      throw IllegalArgumentException("Geçerli görsel yolu bulunamadı.")
    }

    val uri = Uri.parse(trimmed)
    val options = BitmapFactory.Options().apply {
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }

    val decoded = when {
      uri.scheme == "content" || uri.scheme == "file" -> {
        context.contentResolver.openInputStream(uri)?.use { stream ->
          BitmapFactory.decodeStream(stream, null, options)
        }
      }

      trimmed.startsWith("/") -> BitmapFactory.decodeFile(trimmed, options)
      else -> BitmapFactory.decodeFile(trimmed.removePrefix("file://"), options)
    } ?: throw IllegalStateException("Kaşe görseli okunamadı.")

    return decoded.copy(Bitmap.Config.ARGB_8888, true)
  }

  private fun removeBackgroundHeuristic(sourceBitmap: Bitmap): Pair<Bitmap, Int> {
    val width = sourceBitmap.width
    val height = sourceBitmap.height
    val pixelCount = width * height
    val pixels = IntArray(pixelCount)

    sourceBitmap.getPixels(pixels, 0, width, 0, 0, width, height)

    val background = sampleBorderColor(pixels, width, height)
    val visited = BooleanArray(pixelCount)
    val queue = IntArray(pixelCount)
    var head = 0
    var tail = 0

    fun enqueueIfBackground(index: Int) {
      if (index < 0 || index >= pixelCount || visited[index]) {
        return
      }

      val color = pixels[index]

      if (!shouldTreatAsBackground(color, background)) {
        return
      }

      visited[index] = true
      queue[tail] = index
      tail += 1
    }

    for (x in 0 until width) {
      enqueueIfBackground(x)
      enqueueIfBackground((height - 1) * width + x)
    }

    for (y in 0 until height) {
      enqueueIfBackground(y * width)
      enqueueIfBackground(y * width + (width - 1))
    }

    while (head < tail) {
      val index = queue[head]
      head += 1

      val x = index % width
      val y = index / width

      if (x > 0) {
        enqueueIfBackground(index - 1)
      }
      if (x < width - 1) {
        enqueueIfBackground(index + 1)
      }
      if (y > 0) {
        enqueueIfBackground(index - width)
      }
      if (y < height - 1) {
        enqueueIfBackground(index + width)
      }
    }

    var removedPixels = 0

    for (index in 0 until pixelCount) {
      val color = pixels[index]

      if (visited[index]) {
        pixels[index] = Color.argb(
          0,
          Color.red(color),
          Color.green(color),
          Color.blue(color),
        )
        removedPixels += 1
        continue
      }

      pixels[index] = softenNearBackgroundPixels(color, background)
    }

    val output = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    output.setPixels(pixels, 0, width, 0, 0, width, height)

    return output to removedPixels
  }

  private fun sampleBorderColor(
    pixels: IntArray,
    width: Int,
    height: Int,
  ): RgbColor {
    var redSum = 0L
    var greenSum = 0L
    var blueSum = 0L
    var count = 0L

    fun accumulate(index: Int) {
      if (index < 0 || index >= pixels.size) {
        return
      }

      val color = pixels[index]
      val alpha = Color.alpha(color)

      if (alpha <= 8) {
        return
      }

      redSum += Color.red(color).toLong()
      greenSum += Color.green(color).toLong()
      blueSum += Color.blue(color).toLong()
      count += 1
    }

    for (x in 0 until width) {
      accumulate(x)
      accumulate((height - 1) * width + x)
    }

    for (y in 1 until max(1, height - 1)) {
      accumulate(y * width)
      accumulate(y * width + (width - 1))
    }

    if (count == 0L) {
      return RgbColor(255, 255, 255)
    }

    return RgbColor(
      r = (redSum / count).toInt(),
      g = (greenSum / count).toInt(),
      b = (blueSum / count).toInt(),
    )
  }

  private fun shouldTreatAsBackground(
    color: Int,
    background: RgbColor,
  ): Boolean {
    val alpha = Color.alpha(color)

    if (alpha <= 8) {
      return false
    }

    val brightness = brightness(color)
    val distance = colorDistance(color, background)

    return brightness >= 150 && distance <= 58
  }

  private fun softenNearBackgroundPixels(
    color: Int,
    background: RgbColor,
  ): Int {
    val originalAlpha = Color.alpha(color)

    if (originalAlpha <= 8) {
      return color
    }

    val brightness = brightness(color)
    val distance = colorDistance(color, background)

    if (brightness < 180 || distance > 72) {
      return color
    }

    val softness = 1f - (distance.toFloat() / 72f)
    val targetAlpha = max(
      28,
      min(
        originalAlpha,
        (255f * (1f - softness * 0.85f)).toInt(),
      ),
    )

    return Color.argb(
      targetAlpha,
      Color.red(color),
      Color.green(color),
      Color.blue(color),
    )
  }

  private fun colorDistance(
    color: Int,
    background: RgbColor,
  ): Int {
    return max(
      abs(Color.red(color) - background.r),
      max(
        abs(Color.green(color) - background.g),
        abs(Color.blue(color) - background.b),
      ),
    )
  }

  private fun brightness(color: Int): Int {
    return (Color.red(color) + Color.green(color) + Color.blue(color)) / 3
  }

  private fun removalThreshold(
    width: Int,
    height: Int,
  ): Int {
    return max(32, (width + height) / 4)
  }
}