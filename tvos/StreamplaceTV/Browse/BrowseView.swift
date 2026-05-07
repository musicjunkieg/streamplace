import SwiftUI

struct BrowseView: View {
    @StateObject private var viewModel = BrowseViewModel()
    @EnvironmentObject private var settings: AppSettings

    private let columns = [
        GridItem(.adaptive(minimum: 420), spacing: 48)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                content
                    .padding(.horizontal, 80)
                    .padding(.top, 32)
                    .padding(.bottom, 80)
            }
            .navigationTitle("Streamplace")
        }
        .task {
            viewModel.startPolling()
        }
        .onDisappear {
            viewModel.stopPolling()
        }
        .onChange(of: settings.serverURLString) { _, _ in
            Task { await viewModel.refresh() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.streams.isEmpty {
            switch viewModel.state {
            case .idle, .loading:
                loadingPlaceholder
            case .failed(let message):
                errorPlaceholder(message)
            case .loaded:
                emptyPlaceholder
            }
        } else {
            grid
        }
    }

    private var emptyPlaceholder: some View {
        VStack(spacing: 16) {
            Image(systemName: "tv.slash")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)
            Text("No one is live right now.")
                .font(.title2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 600)
    }

    private var grid: some View {
        LazyVGrid(columns: columns, spacing: 56) {
            ForEach(viewModel.streams) { stream in
                NavigationLink(value: stream) {
                    StreamCardView(stream: stream)
                }
                .buttonStyle(.card)
            }
        }
        .navigationDestination(for: LiveStream.self) { stream in
            PlayerView(stream: stream)
        }
    }

    private var loadingPlaceholder: some View {
        VStack(spacing: 24) {
            ProgressView()
                .scaleEffect(2)
            Text("Loading live streams…")
                .font(.title3)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 600)
    }

    private func errorPlaceholder(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.yellow)
            Text("Couldn't load streams")
                .font(.title2.bold())
            Text(message)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 200)
            Button("Try again") {
                Task { await viewModel.refresh() }
            }
            .padding(.top, 16)
        }
        .frame(maxWidth: .infinity, minHeight: 600)
    }
}

#Preview {
    BrowseView()
        .environmentObject(AppSettings.shared)
}
