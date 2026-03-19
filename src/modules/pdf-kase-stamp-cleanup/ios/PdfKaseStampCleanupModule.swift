import ExpoModulesCore
import UIKit

public final class PdfKaseStampCleanupModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PdfKaseStampCleanup")

    AsyncFunction("removeBackground") { (sourceUri: String, _: [String: Any]?) throws -> [String: Any] in
      try Self.removeBackground(sourceUri: sourceUri)
    }
  }

  private struct RGBColor {
    let r: Int
    let g: Int
    let b: Int
  }

  private static func removeBackground(sourceUri: String) throws -> [String: Any] {
    let image = try loadImage(from: sourceUri)
    var rgba = try rgbaBytes(from: image)
    let background = sampleBorderColor(bytes: rgba.bytes, width: rgba.width, height: rgba.height)

    let pixelCount = rgba.width * rgba.height
    var visited = [Bool](repeating: false, count: pixelCount)
    var queue = [Int](repeating: 0, count: pixelCount)
    var head = 0
    var tail = 0

    func enqueueIfBackground(_ index: Int) {
      if index < 0 || index >= pixelCount || visited[index] {
        return
      }

      let offset = index * 4

      if !shouldTreatAsBackground(bytes: rgba.bytes, offset: offset, background: background) {
        return
      }

      visited[index] = true
      queue[tail] = index
      tail += 1
    }

    for x in 0 ..< rgba.width {
      enqueueIfBackground(x)
      enqueueIfBackground((rgba.height - 1) * rgba.width + x)
    }

    if rgba.height > 2 {
      for y in 1 ..< (rgba.height - 1) {
        enqueueIfBackground(y * rgba.width)
        enqueueIfBackground(y * rgba.width + (rgba.width - 1))
      }
    }

    while head < tail {
      let index = queue[head]
      head += 1

      let x = index % rgba.width
      let y = index / rgba.width

      if x > 0 {
        enqueueIfBackground(index - 1)
      }
      if x < rgba.width - 1 {
        enqueueIfBackground(index + 1)
      }
      if y > 0 {
        enqueueIfBackground(index - rgba.width)
      }
      if y < rgba.height - 1 {
        enqueueIfBackground(index + rgba.width)
      }
    }

    var removedPixels = 0

    for index in 0 ..< pixelCount {
      let offset = index * 4

      if visited[index] {
        rgba.bytes[offset + 3] = 0
        removedPixels += 1
        continue
      }

      softenNearBackgroundPixel(bytes: &rgba.bytes, offset: offset, background: background)
    }

    let outputURL = try savePNG(bytes: rgba.bytes, width: rgba.width, height: rgba.height)

    return [
      "cleanedUri": outputURL.absoluteString,
      "backgroundRemoved": removedPixels > removalThreshold(width: rgba.width, height: rgba.height),
      "provider": "native-ios-heuristic"
    ]
  }

  private static func loadImage(from sourceUri: String) throws -> UIImage {
    let trimmed = sourceUri.trimmingCharacters(in: .whitespacesAndNewlines)

    if trimmed.isEmpty {
      throw makeError("Arka plan temizleme için geçerli görsel gerekli.")
    }

    let url: URL
    if let parsed = URL(string: trimmed), parsed.scheme != nil {
      url = parsed
    } else {
      url = URL(fileURLWithPath: trimmed)
    }

    if url.isFileURL, let image = UIImage(contentsOfFile: url.path) {
      return normalizeOrientation(of: image)
    }

    let data = try Data(contentsOf: url)

    guard let image = UIImage(data: data) else {
      throw makeError("Kaşe görseli okunamadı.")
    }

    return normalizeOrientation(of: image)
  }

  private static func normalizeOrientation(of image: UIImage) -> UIImage {
    guard image.imageOrientation != .up else {
      return image
    }

    UIGraphicsBeginImageContextWithOptions(image.size, false, image.scale)
    defer { UIGraphicsEndImageContext() }

    image.draw(in: CGRect(origin: .zero, size: image.size))
    return UIGraphicsGetImageFromCurrentImageContext() ?? image
  }

  private static func rgbaBytes(from image: UIImage) throws -> (bytes: [UInt8], width: Int, height: Int) {
    guard let cgImage = image.cgImage else {
      throw makeError("Kaşe görseli çözümlenemedi.")
    }

    let width = cgImage.width
    let height = cgImage.height
    let bytesPerRow = width * 4
    var bytes = [UInt8](repeating: 0, count: width * height * 4)

    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo =
      CGImageAlphaInfo.premultipliedLast.rawValue |
      CGBitmapInfo.byteOrder32Big.rawValue

    let drawn: Bool = bytes.withUnsafeMutableBytes { buffer in
      guard let baseAddress = buffer.baseAddress else {
        return false
      }

      guard let context = CGContext(
        data: baseAddress,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: colorSpace,
        bitmapInfo: bitmapInfo
      ) else {
        return false
      }

      context.interpolationQuality = .high
      context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }

    if !drawn {
      throw makeError("Kaşe piksel verisi hazırlanamadı.")
    }

    return (bytes, width, height)
  }

  private static func savePNG(bytes: [UInt8], width: Int, height: Int) throws -> URL {
    let bytesPerRow = width * 4
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo =
      CGImageAlphaInfo.premultipliedLast.rawValue |
      CGBitmapInfo.byteOrder32Big.rawValue

    var mutableBytes = bytes
    let image: UIImage = try mutableBytes.withUnsafeMutableBytes { buffer in
      guard let baseAddress = buffer.baseAddress else {
        throw makeError("PNG oluşturma belleği hazırlanamadı.")
      }

      guard let context = CGContext(
        data: baseAddress,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: colorSpace,
        bitmapInfo: bitmapInfo
      ) else {
        throw makeError("PNG oluşturma context'i açılamadı.")
      }

      guard let cgImage = context.makeImage() else {
        throw makeError("PNG çıktısı oluşturulamadı.")
      }

      return UIImage(cgImage: cgImage)
    }

    guard let pngData = image.pngData() else {
      throw makeError("PNG verisi yazılamadı.")
    }

    let outputURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("stamp-cleanup-\(UUID().uuidString)")
      .appendingPathExtension("png")

    try pngData.write(to: outputURL, options: .atomic)
    return outputURL
  }

  private static func sampleBorderColor(bytes: [UInt8], width: Int, height: Int) -> RGBColor {
    var redSum = 0
    var greenSum = 0
    var blueSum = 0
    var count = 0

    func accumulate(_ pixelIndex: Int) {
      if pixelIndex < 0 || pixelIndex >= width * height {
        return
      }

      let offset = pixelIndex * 4
      let alpha = Int(bytes[offset + 3])

      if alpha <= 8 {
        return
      }

      redSum += Int(bytes[offset])
      greenSum += Int(bytes[offset + 1])
      blueSum += Int(bytes[offset + 2])
      count += 1
    }

    for x in 0 ..< width {
      accumulate(x)
      accumulate((height - 1) * width + x)
    }

    if height > 2 {
      for y in 1 ..< (height - 1) {
        accumulate(y * width)
        accumulate(y * width + (width - 1))
      }
    }

    if count == 0 {
      return RGBColor(r: 255, g: 255, b: 255)
    }

    return RGBColor(
      r: redSum / count,
      g: greenSum / count,
      b: blueSum / count
    )
  }

  private static func shouldTreatAsBackground(
    bytes: [UInt8],
    offset: Int,
    background: RGBColor
  ) -> Bool {
    let alpha = Int(bytes[offset + 3])

    if alpha <= 8 {
      return false
    }

    let brightnessValue = brightness(bytes: bytes, offset: offset)
    let distance = colorDistance(bytes: bytes, offset: offset, background: background)

    return brightnessValue >= 150 && distance <= 58
  }

  private static func softenNearBackgroundPixel(
    bytes: inout [UInt8],
    offset: Int,
    background: RGBColor
  ) {
    let originalAlpha = Int(bytes[offset + 3])

    if originalAlpha <= 8 {
      return
    }

    let brightnessValue = brightness(bytes: bytes, offset: offset)
    let distance = colorDistance(bytes: bytes, offset: offset, background: background)

    if brightnessValue < 180 || distance > 72 {
      return
    }

    let softness = 1 - (Double(distance) / 72.0)
    let targetAlpha = max(
      28,
      min(
        originalAlpha,
        Int(255.0 * (1.0 - softness * 0.85))
      )
    )

    bytes[offset + 3] = UInt8(targetAlpha)
  }

  private static func colorDistance(
    bytes: [UInt8],
    offset: Int,
    background: RGBColor
  ) -> Int {
    let redDistance = abs(Int(bytes[offset]) - background.r)
    let greenDistance = abs(Int(bytes[offset + 1]) - background.g)
    let blueDistance = abs(Int(bytes[offset + 2]) - background.b)

    return max(redDistance, max(greenDistance, blueDistance))
  }

  private static func brightness(bytes: [UInt8], offset: Int) -> Int {
    return (
      Int(bytes[offset]) +
      Int(bytes[offset + 1]) +
      Int(bytes[offset + 2])
    ) / 3
  }

  private static func removalThreshold(width: Int, height: Int) -> Int {
    return max(32, (width + height) / 4)
  }

  private static func makeError(_ message: String) -> NSError {
    NSError(
      domain: "PdfKaseStampCleanup",
      code: 1,
      userInfo: [NSLocalizedDescriptionKey: message]
    )
  }
}