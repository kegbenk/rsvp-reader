import Capacitor
import Foundation

#if canImport(FolioReaderKit)
import FolioReaderKit
#endif

@objc(FolioReaderPlugin)
public class FolioReaderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FolioReaderPlugin"
    public let jsName = "FolioReader"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    @objc func open(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? "EPUB"

#if canImport(FolioReaderKit)
        let config = FolioReaderConfig()
        let folioReader = FolioReader()

        func present(_ epubPath: String) {
            DispatchQueue.main.async { [weak self] in
                guard let viewController = self?.bridge?.viewController else {
                    call.reject("Bridge view controller not available")
                    return
                }

                folioReader.presentReader(parentViewController: viewController, withEpubPath: epubPath, andConfig: config)
                call.resolve(["title": title])
            }
        }

        if let path = call.getString("path") {
            present(path)
            return
        }

        guard let dataString = call.getString("data") else {
            call.reject("Missing required 'data' or 'path'")
            return
        }

        guard let fileName = call.getString("fileName") else {
            call.reject("Missing required 'fileName'")
            return
        }

        guard let data = Data(base64Encoded: dataString) else {
            call.reject("Failed to decode base64 data")
            return
        }

        let tmpDir = FileManager.default.temporaryDirectory
        let fileURL = tmpDir.appendingPathComponent(fileName)

        do {
            try data.write(to: fileURL, options: .atomic)
            present(fileURL.path)
        } catch {
            call.reject("Failed to write EPUB to temporary storage")
        }
#else
        call.reject("FolioReaderKit is not available in this build")
#endif
    }
}
