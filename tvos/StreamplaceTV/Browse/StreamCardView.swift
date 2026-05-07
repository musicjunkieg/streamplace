import SwiftUI

struct StreamCardView: View {
    let stream: LiveStream

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack(alignment: .topLeading) {
                thumbnail
                    .frame(maxWidth: .infinity)
                    .aspectRatio(16.0 / 9.0, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                liveBadge
                    .padding(14)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(stream.title)
                    .font(.headline)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                HStack(spacing: 8) {
                    Text(stream.streamerName)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)

                    Spacer(minLength: 0)

                    Label("\(stream.viewers)", systemImage: "person.2.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .labelStyle(.titleAndIcon)
                }
            }
            .padding(.horizontal, 4)
        }
    }

    @ViewBuilder
    private var thumbnail: some View {
        if let urlString = stream.author.avatar, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                default:
                    placeholder
                }
            }
        } else {
            placeholder
        }
    }

    private var placeholder: some View {
        LinearGradient(
            colors: [Color.accentColor.opacity(0.6), Color.accentColor.opacity(0.2)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .overlay(
            Image(systemName: "play.tv.fill")
                .font(.system(size: 64, weight: .bold))
                .foregroundStyle(.white.opacity(0.7))
        )
    }

    private var liveBadge: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(Color.red)
                .frame(width: 10, height: 10)
            Text("LIVE")
                .font(.caption.weight(.bold))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial, in: Capsule())
    }
}
