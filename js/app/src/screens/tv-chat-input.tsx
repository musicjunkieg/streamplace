import { useRoute } from "@react-navigation/native";
import {
  ChatBox,
  LivestreamProvider,
  Text,
  useDID,
} from "@streamplace/components";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "src/navigation-types";

// Deep-link target on the phone for "type as the TV's chat keyboard".
//   streamplace://tv-chat-input/<handle>
// The screen wraps the existing ChatBox in a fullscreen container scoped
// to the streamer the TV is currently watching. The phone account does
// the posting; the TV picks up the resulting chat record via the same
// websocket every other client uses.

export default function TVChatInput() {
  const route = useRoute<RootStackParamList, "TVChatInput">("TVChatInput");
  const streamer = route.params?.streamer;
  const did = useDID();
  const [emojiData, setEmojiData] = useState<any>(null);

  // ChatBox accepts a pre-loaded emoji data blob; we don't need it for
  // the TV companion flow (no emoji picker on the typing surface) so we
  // just pass null. The component renders without it.
  useEffect(() => {
    setEmojiData(null);
  }, []);

  if (!streamer) {
    return <Centered>No streamer specified.</Centered>;
  }
  if (!did) {
    return <Centered>Sign in on this device before using TV chat.</Centered>;
  }

  return (
    <LivestreamProvider src={streamer}>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#0b0b0e" }}
        edges={["bottom"]}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: "#1a1a22",
          }}
        >
          <Text style={{ color: "#9aa0a6", fontSize: 13 }}>
            Chatting on your Apple TV as
          </Text>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>
            {streamer}
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: "flex-end", padding: 16 }}>
          <ChatBox emojiData={emojiData} hideLogin isPopout />
        </View>
      </SafeAreaView>
    </LivestreamProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Text style={{ fontSize: 18, textAlign: "center" }}>{children}</Text>
    </View>
  );
}
