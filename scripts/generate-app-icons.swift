import AppKit
import Foundation

struct IconSpec {
    let filename: String
    let size: Int
}

let specs = [
    IconSpec(filename: "favicon.png", size: 32),
    IconSpec(filename: "apple-touch-icon.png", size: 180),
    IconSpec(filename: "icon-192.png", size: 192),
    IconSpec(filename: "icon-512.png", size: 512),
]

let logoInsetRatio: CGFloat = 0.18

func renderIcon(source: URL, destination: URL, size: Int) throws {
    guard let sourceImage = NSImage(contentsOf: source) else {
        throw NSError(domain: "GenerateIcons", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unable to read source image at \(source.path)"])
    }

    let canvasSize = NSSize(width: size, height: size)
    let outputImage = NSImage(size: canvasSize)

    outputImage.lockFocus()
    NSColor.white.setFill()
    NSBezierPath(rect: NSRect(origin: .zero, size: canvasSize)).fill()

    let maxLogoSize = CGFloat(size) * (1 - (logoInsetRatio * 2))
    let sourceSize = sourceImage.size
    let scale = min(maxLogoSize / sourceSize.width, maxLogoSize / sourceSize.height)
    let drawSize = NSSize(width: sourceSize.width * scale, height: sourceSize.height * scale)
    let drawRect = NSRect(
        x: (CGFloat(size) - drawSize.width) / 2,
        y: (CGFloat(size) - drawSize.height) / 2,
        width: drawSize.width,
        height: drawSize.height
    )

    sourceImage.draw(in: drawRect, from: .zero, operation: .sourceOver, fraction: 1)
    outputImage.unlockFocus()

    guard
        let tiffData = outputImage.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiffData),
        let pngData = bitmap.representation(using: .png, properties: [:])
    else {
        throw NSError(domain: "GenerateIcons", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unable to encode PNG for \(destination.lastPathComponent)"])
    }

    try pngData.write(to: destination)
}

let repoRoot = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let publicDir = repoRoot.appendingPathComponent("public", isDirectory: true)
let source = publicDir.appendingPathComponent("gpe-hub-icon.png")

guard FileManager.default.fileExists(atPath: source.path) else {
    fputs("Missing source image: \(source.path)\n", stderr)
    exit(1)
}

for spec in specs {
    let destination = publicDir.appendingPathComponent(spec.filename)
    try renderIcon(source: source, destination: destination, size: spec.size)
    print("Generated \(destination.lastPathComponent) (\(spec.size)x\(spec.size))")
}
