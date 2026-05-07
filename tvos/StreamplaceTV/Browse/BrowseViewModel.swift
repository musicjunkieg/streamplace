import Foundation
import SwiftUI

@MainActor
final class BrowseViewModel: ObservableObject {
    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    @Published private(set) var streams: [LiveStream] = []
    @Published private(set) var state: LoadState = .idle

    /// Matches the 3s polling interval used by the web/mobile clients
    /// (`js/components/src/streamplace-provider/poller.tsx`).
    private static let pollInterval: TimeInterval = 3

    private var pollTask: Task<Void, Never>?

    func startPolling() {
        guard pollTask == nil else { return }
        pollTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                await self.refresh()
                try? await Task.sleep(nanoseconds: UInt64(Self.pollInterval * 1_000_000_000))
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    func refresh() async {
        if streams.isEmpty { state = .loading }
        do {
            let fresh = try await StreamplaceAPI.shared.getLiveUsers()
            self.streams = fresh
            self.state = .loaded
        } catch {
            self.state = .failed(error.localizedDescription)
        }
    }
}
