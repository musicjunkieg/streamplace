# Streamplace for Apple TV

A native tvOS app for browsing and watching live Streamplace streams on the
biggest screen in the house. Built in Swift + SwiftUI with `AVKit` driving
HLS playback.

## What it does (v1)

- **Live grid** — polls `place.stream.live.getLiveUsers` every 3s (matching
  the web/mobile clients in `js/components/src/streamplace-provider/poller.tsx`)
  and lays the active streams out as a focusable card grid.
- **Player** — picks any stream and plays it through `AVPlayer` against
  `/api/playback/{handle}/hls/index.m3u8`. The siri remote scrubber, AirPlay,
  and tvOS background audio all come "for free" from `VideoPlayer`.
- **Settings** — point the app at any Streamplace node by editing the server
  URL (defaults to `https://stream.place`, mirrors `EXPO_PUBLIC_STREAMPLACE_URL`).

## What's intentionally *not* here

- **Auth / chat / posting** — ATProto OAuth on tvOS needs a device-code or
  paired-login flow, which is its own project. The app is anonymous-viewing
  only for v1.
- **WebRTC / WHEP playback** — WebRTC on tvOS would require linking
  `WebRTC.xcframework`. HLS via `AVPlayer` is good enough and ships zero
  third-party code.
- **Top Shelf extension / continue-watching** — easy follow-up once the core
  works.

## Building

You need Xcode 15+ (tvOS 17 SDK) and [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```sh
brew install xcodegen
cd tvos
xcodegen generate
open StreamplaceTV.xcodeproj
```

Then pick the **Apple TV** scheme and run on the simulator (`Apple TV 4K
(3rd generation)` works fine) or on a real Apple TV after pairing it for
development in Xcode.

### Code signing

For a real device, set your Apple Developer Team ID in the environment
before generating:

```sh
SP_APPLE_TEAM_ID=ABCDE12345 xcodegen generate
```

Or configure it once in Xcode after generating the project.

## Project layout

```
tvos/
├── project.yml              # XcodeGen config — owns the Xcode project
├── StreamplaceTV/
│   ├── App/                 # @main, root TabView, AppSettings
│   ├── API/                 # XRPC client + decodable models
│   ├── Browse/              # Live grid + view-model + card cell
│   ├── Player/              # AVPlayer-backed VideoPlayer view
│   ├── Settings/            # Server URL editor
│   └── Resources/
│       └── Assets.xcassets/ # AppIcon.brandassets, accent color
└── README.md
```

The `Assets.xcassets/AppIcon.brandassets/` stack is structurally complete but
doesn't yet have artwork — drop tvOS icon layers into the
`Front/Middle/Back.imagestacklayer/Content.imageset` folders before
shipping to TestFlight.
