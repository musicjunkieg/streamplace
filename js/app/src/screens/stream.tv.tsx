import { useNavigation, useRoute } from "@react-navigation/native";
import {
  Chat,
  LivestreamProvider,
  Text,
  useUrl,
} from "@streamplace/components";
import { QRCode } from "components/tv/qr-code";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

const PLAYER_BG = "#000";
const SIDEBAR_BG = "#0e0e12";
const SIDEBAR_WIDTH = 460;

export default function StreamTV() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const user: string = route.params?.user;

  if (!user) {
    return <Center>No stream specified.</Center>;
  }

  return (
    <LivestreamProvider src={user}>
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#000" }}>
        <View style={{ flex: 1, backgroundColor: PLAYER_BG }}>
          <PlayerPane user={user} />
        </View>
        <View
          style={{
            width: SIDEBAR_WIDTH,
            backgroundColor: SIDEBAR_BG,
            borderLeftWidth: 1,
            borderLeftColor: "#1a1a22",
          }}
        >
          <ChatPane user={user} />
        </View>
        <BackHandlerHint onBack={() => navigation.goBack()} />
      </View>
    </LivestreamProvider>
  );
}

function PlayerPane({ user }: { user: string }) {
  const url = useUrl();
  const hlsUrl = `${url}/api/playback/${encodeURIComponent(user)}/hls/index.m3u8`;
  const player = useVideoPlayer(hlsUrl, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    return () => {
      // Defensive: explicit pause helps tvOS release the decoder promptly
      try {
        player?.pause();
      } catch {}
    };
  }, [player]);

  return (
    <View style={{ flex: 1 }}>
      <VideoView
        player={player}
        style={{ flex: 1 }}
        contentFit="contain"
        nativeControls={true}
        allowsFullscreen={false}
      />
    </View>
  );
}

function ChatPane({ user }: { user: string }) {
  const deepLink = useMemo(
    () => `streamplace://tv-chat-input/${encodeURIComponent(user)}`,
    [user],
  );

  return (
    <View style={{ flex: 1, padding: 18 }}>
      <View style={{ marginBottom: 18 }}>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>
          Chat
        </Text>
        <Text style={{ color: "#9aa0a6", fontSize: 14 }}>{user}</Text>
      </View>

      <View style={{ flex: 1, marginBottom: 18 }}>
        <Chat shownMessages={40} reverse={false} />
      </View>

      <ChatCompanionQR deepLink={deepLink} />
    </View>
  );
}

function ChatCompanionQR({ deepLink }: { deepLink: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        backgroundColor: "#16161c",
        borderRadius: 14,
      }}
    >
      <View style={{ marginRight: 14, borderRadius: 8, overflow: "hidden" }}>
        <QRCode value={deepLink} size={112} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
          Type from your phone
        </Text>
        <Text style={{ color: "#9aa0a6", fontSize: 13, marginTop: 4 }}>
          Scan with the Streamplace app to chat as your phone account.
        </Text>
      </View>
    </View>
  );
}

function BackHandlerHint({ onBack }: { onBack: () => void }) {
  // Invisible focusable button captures Menu/Back on the Siri remote.
  // Pressable with no children stays focusable; tvOS routes the menu
  // gesture to navigation.goBack automatically when used inside a
  // native-stack, but we keep this as a fallback for older RN tvOS.
  const [_focus, setFocus] = useState(false);
  return (
    <Pressable
      onPress={onBack}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
    />
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000",
      }}
    >
      <Text style={{ color: "#fff", fontSize: 24 }}>{children}</Text>
    </View>
  );
}
