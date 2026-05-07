import Foundation

// Mirror of the relevant fields from `place.stream.livestream#livestreamView`
// and `app.bsky.actor.defs#profileViewBasic`. We decode only what the TV
// browse + player needs.

struct LiveAuthor: Decodable, Hashable {
    let did: String
    let handle: String
    let displayName: String?
    let avatar: String?
}

struct LiveRecord: Decodable, Hashable {
    let title: String?
    let createdAt: String?
    let url: String?
    let canonicalUrl: String?
}

struct ViewerCount: Decodable, Hashable {
    let count: Int
}

struct LiveStream: Decodable, Identifiable, Hashable {
    let uri: String
    let cid: String
    let author: LiveAuthor
    let record: LiveRecord
    let indexedAt: String
    let viewerCount: ViewerCount?

    var id: String { uri }

    var title: String { record.title ?? "Untitled stream" }
    var streamerName: String { author.displayName?.isEmpty == false ? author.displayName! : author.handle }
    var viewers: Int { viewerCount?.count ?? 0 }

    /// The identifier the playback API uses — Streamplace keys playback by handle.
    var playbackKey: String { author.handle }
}

struct GetLiveUsersResponse: Decodable {
    let streams: [LiveStream]?
}

struct XRPCError: Decodable, LocalizedError {
    let error: String?
    let message: String?

    var errorDescription: String? {
        message ?? error ?? "Unknown XRPC error"
    }
}
