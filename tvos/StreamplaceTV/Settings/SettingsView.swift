import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var settings: AppSettings
    @State private var draftURL: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Server URL", text: $draftURL)
                        .textContentType(.URL)
                        .autocorrectionDisabled()

                    HStack {
                        Button("Save") {
                            settings.serverURLString = draftURL.trimmingCharacters(in: .whitespaces)
                        }
                        .disabled(draftURL.trimmingCharacters(in: .whitespaces).isEmpty)

                        Button("Reset to default", role: .destructive) {
                            settings.resetServerURL()
                            draftURL = settings.serverURLString
                        }
                    }
                } header: {
                    Text("Streamplace Server")
                } footer: {
                    Text("Defaults to \(AppSettings.defaultServerURLString). Point at a self-hosted Streamplace node by entering its base URL.")
                }

                Section("About") {
                    LabeledContent("Version", value: appVersion)
                    LabeledContent("Project", value: "stream.place")
                }
            }
            .navigationTitle("Settings")
        }
        .onAppear { draftURL = settings.serverURLString }
    }

    private var appVersion: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        return "\(v) (\(b))"
    }
}

#Preview {
    SettingsView()
        .environmentObject(AppSettings.shared)
}
