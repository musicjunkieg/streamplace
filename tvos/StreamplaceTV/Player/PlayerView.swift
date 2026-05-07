import SwiftUI
import AVKit

struct PlayerView: View {
    let stream: LiveStream

    @State private var player: AVPlayer?

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let player {
                VideoPlayer(player: player)
                    .ignoresSafeArea()
            } else {
                ProgressView()
                    .scaleEffect(2)
                    .tint(.white)
            }
        }
        .onAppear { startPlayback() }
        .onDisappear { stopPlayback() }
    }

    private func startPlayback() {
        let url = StreamplaceAPI.shared.hlsURL(for: stream)
        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        player.allowsExternalPlayback = true
        player.automaticallyWaitsToMinimizeStalling = true
        player.play()
        self.player = player
    }

    private func stopPlayback() {
        player?.pause()
        player?.replaceCurrentItem(with: nil)
        player = nil
    }
}
