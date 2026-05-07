import Foundation

actor StreamplaceAPI {
    static let shared = StreamplaceAPI()

    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    private var baseURL: URL {
        AppSettings.shared.serverURL
    }

    // MARK: - XRPC

    func getLiveUsers(limit: Int = 50) async throws -> [LiveStream] {
        var components = URLComponents(
            url: baseURL.appendingPathComponent("xrpc/place.stream.live.getLiveUsers"),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [URLQueryItem(name: "limit", value: String(limit))]

        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        try Self.validate(response: response, data: data)

        let decoded = try JSONDecoder().decode(GetLiveUsersResponse.self, from: data)
        return decoded.streams ?? []
    }

    // MARK: - Playback URL

    /// HLS master playlist for a stream. tvOS's AVPlayer handles this natively.
    nonisolated func hlsURL(for stream: LiveStream) -> URL {
        hlsURL(forKey: stream.playbackKey)
    }

    nonisolated func hlsURL(forKey key: String) -> URL {
        let base = AppSettings.shared.serverURL
        let escaped = key.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? key
        return base
            .appendingPathComponent("api/playback/\(escaped)/hls/index.m3u8", isDirectory: false)
    }

    // MARK: - Helpers

    private static func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if let xrpc = try? JSONDecoder().decode(XRPCError.self, from: data) {
                throw xrpc
            }
            throw NSError(
                domain: "StreamplaceAPI",
                code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: "HTTP \(http.statusCode)"]
            )
        }
    }
}
