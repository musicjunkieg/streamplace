note because this is in a monorepo had to remove react, react-dom, and
react-native-web deps and change metro.config.js a bit.

## Apple TV (tvOS)

The app builds for Apple TV via [react-native-tvos][rntvos], a community fork
of React Native that adds tvOS support. The Expo app at `js/app` is the same
codebase — TV-specific surfaces live alongside their phone siblings as
`.tv.tsx` platform extensions, picked up by the Metro resolver only when
building for tvOS.

[rntvos]: https://github.com/react-native-tvos/react-native-tvos

### Building

Requires Xcode 15+ with the tvOS SDK installed.

```sh
cd js/app
pnpm install
npx expo prebuild --platform ios --clean
open ios/Streamplace.xcworkspace
# pick the Apple TV scheme in Xcode, or:
xcodebuild -workspace ios/Streamplace.xcworkspace -scheme Streamplace \
  -sdk appletvsimulator \
  -destination 'platform=tvOS Simulator,name=Apple TV' build
```

Or from the repo root:

```sh
make tvos
```

### Login on tvOS (device-pairing)

tvOS has no `SFSafariViewController`, so the standard ATProto OAuth flow can't
run on the device. Instead the TV pairs with a phone or browser:

```
┌──────── Apple TV ────────┐    ┌──── Streamplace server ────┐    ┌──── Phone / browser ────┐
│ login.tv.tsx             │    │ pkg/api/tvos_auth.go        │    │                          │
│  → POST /tvos-auth/start │ ─► │  generate userCode          │    │ Scan QR or open Pair TV  │
│  ← {userCode, qrUrl, …}  │    │                             │    │  in mobile app           │
│ show QR + userCode       │    │                             │ ◄─ │ POST /complete-browser   │
│                          │    │                             │    │   or /complete-mobile    │
│  → poll /tvos-auth/{id}  │ ─► │  return bundle when ready   │    │   { sessionBundle… }     │
│  ← {status, session}     │    │                             │    │                          │
│ persist bundle           │    │                             │    │                          │
└──────────────────────────┘    └─────────────────────────────┘    └──────────────────────────┘
```

- **QR flow** (`/auth/tv?code=…`): the phone opens that URL in a browser,
  signs in via the same `LoginForm` as everywhere else, then posts its
  session bundle to the server. Implemented in
  `src/screens/tvos-auth.tsx`.
- **Mobile app pairing**: an already-signed-in user opens "Pair Apple TV"
  in the mobile app, types the userCode, and the app posts its current
  session bundle. Implemented in `src/screens/pair-tv.tsx`.

### Companion chat (phone keyboard, TV display)

While playing a stream the TV shows a small QR encoding
`streamplace://tv-chat-input/<handle>`. Scanning it on a logged-in phone
opens a fullscreen chat composer scoped to that streamer
(`src/screens/tv-chat-input.tsx`). Messages flow through the existing
ATProto + websocket plumbing — no new server work needed for chat.

### Deploying your own node for TV testing

The `tvos-auth` endpoints are not on stream.place (yet), so login needs a
node built from this branch. The dependency map:

| Feature                         | Works against stream.place? | Needs custom node | Needs new mobile build |
| ------------------------------- | --------------------------- | ----------------- | ---------------------- |
| Anonymous browse + HLS playback | yes                         |                   |                        |
| Chat display on TV              | yes                         |                   |                        |
| Chat posting from phone         | yes (goes via your PDS)     |                   |                        |
| QR login (`/auth/tv`)           |                             | yes               |                        |
| In-app "Pair Apple TV"          |                             | yes               | yes                    |
| `tv-chat-input` deep link       |                             |                   | yes                    |

Notes:

- The `/auth/tv` web page ships **inside the node binary** — the web
  frontend is embedded from `js/app/dist` (`js/app/app.go`) — so a node
  built from this branch serves both the pairing API and the browser
  page. One artifact covers the whole QR flow.
- **Build the node on a Mac.** `make` from this branch is CI-verified on
  macOS (darwin-arm64). The Linux build currently trips a pre-existing
  glib/pcre2 meson subproject issue when configured from a cold cache;
  it is unrelated to the tvOS work but makes Linux the harder path.
- For local testing, `make dev` boots a node at `http://127.0.0.1:38080`.
  Dev app builds already point there (`.env.development`); the tvOS
  Simulator on the same Mac reaches it directly. A physical Apple TV
  needs your Mac's LAN IP — use Settings → Advanced → custom node URL,
  or bake it in with `EXPO_PUBLIC_STREAMPLACE_URL` at build time.
- The TV pulls its live-streams grid from whatever node it points at. A
  fresh self-hosted node discovers streams via ATProto sync, so its grid
  can differ from stream.place's — expected, not a bug.

### What still doesn't work (known leftovers)

- **Full session rehydration on the TV.** The TV persists the session
  bundle and can authenticate to most XRPC endpoints, but the refresh
  loop (DPoP-signed token renewal from the bundle's exported key) is
  not yet wired through `StreamplaceAgent`. After ~1 hour the access
  token will expire and the TV will silently fall back to anonymous
  viewing; the user has to re-pair. Tracked as the "Bundle → SessionManager
  rehydration" TODO.
- **No `make tvos` CI.** Builds are local-only.
- **No Top Shelf extension** or focus-engine polish beyond focusable
  card scaling.
- **react-native-webrtc** may not load on tvOS — if pod install fails,
  gate it behind `!Platform.isTV` and provide a `.tvos.tsx` stub for
  `use-webrtc`.

### File map

```
js/app/
├── app.config.ts          (+ @react-native-tvos/config-tv plugin)
├── package.json           (react-native aliased to react-native-tvos)
├── metro.config.js        (+ 'tv' platform in resolver)
├── hooks/useIsTV.ts
├── components/tv/
│   ├── focusable-card.tsx
│   └── qr-code.tsx
├── lib/tvos-auth.ts        (client glue: start/poll/complete)
└── src/
    ├── shell.tv.tsx        (TV-only native-stack navigator)
    └── screens/
        ├── home.tv.tsx     (focusable live-streams grid)
        ├── stream.tv.tsx   (fullscreen player + chat sidebar + QR)
        ├── login.tv.tsx    (QR + userCode + polling)
        ├── tvos-auth.tsx   (browser-side OAuth handoff; /auth/tv?code=…)
        ├── pair-tv.tsx     (phone-side in-app pairing)
        └── tv-chat-input.tsx  (phone chat composer for TV)

pkg/api/
├── api.go                  (+ tvos-auth route registrations)
└── tvos_auth.go            (the four pairing endpoints + sweeper)
```
