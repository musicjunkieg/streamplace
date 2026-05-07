import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            BrowseView()
                .tabItem { Label("Live", systemImage: "dot.radiowaves.left.and.right") }

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gear") }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AppSettings.shared)
}
