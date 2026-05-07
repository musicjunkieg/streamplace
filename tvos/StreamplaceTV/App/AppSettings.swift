import Foundation
import Combine

/// User-configurable settings. Mirrors `EXPO_PUBLIC_STREAMPLACE_URL` in the
/// Expo app — defaults to https://stream.place but can be pointed at a
/// self-hosted Streamplace node.
final class AppSettings: ObservableObject {
    static let shared = AppSettings()

    static let defaultServerURLString = "https://stream.place"
    private static let serverURLKey = "streamplace.serverURL"

    @Published var serverURLString: String {
        didSet {
            UserDefaults.standard.set(serverURLString, forKey: Self.serverURLKey)
        }
    }

    var serverURL: URL {
        URL(string: serverURLString) ?? URL(string: Self.defaultServerURLString)!
    }

    private init() {
        self.serverURLString = UserDefaults.standard.string(forKey: Self.serverURLKey)
            ?? Self.defaultServerURLString
    }

    func resetServerURL() {
        serverURLString = Self.defaultServerURLString
    }
}
