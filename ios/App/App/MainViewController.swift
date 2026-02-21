import Capacitor
import Foundation

class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()

        if let folioClass = NSClassFromString("App.FolioReaderPlugin") as? CAPPlugin.Type {
            bridge?.registerPluginType(folioClass)
        } else {
            NSLog("⚡️  Unable to find plugin class App.FolioReaderPlugin")
        }
    }
}
