import { useNavigation } from "@react-navigation/native";
import { Text, useStreamplaceStore } from "@streamplace/components";
import { FocusableCard } from "components/tv/focusable-card";
import { Image } from "expo-image";
import { ScrollView, View } from "react-native";
import type { place } from "streamplace";

const COLUMNS = 3;
const GAP = 32;
const PADDING = 80;

export default function HomeTV() {
  const navigation = useNavigation<any>();
  const liveUsers = useStreamplaceStore((s) => s.liveUsers);
  const loading = useStreamplaceStore((s) => s.liveUsersLoading);
  const error = useStreamplaceStore((s) => s.liveUsersError);

  return (
    <View style={{ flex: 1, backgroundColor: "#0b0b0e" }}>
      <View style={{ paddingHorizontal: PADDING, paddingTop: 48 }}>
        <Text style={{ color: "#fff", fontSize: 56, fontWeight: "700" }}>
          Live now
        </Text>
        <Text
          style={{
            color: "#9aa0a6",
            fontSize: 22,
            marginTop: 6,
          }}
        >
          {liveUsers?.length ?? 0} streaming
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PADDING,
          paddingTop: 40,
          paddingBottom: 80,
        }}
        showsVerticalScrollIndicator={false}
      >
        {error && liveUsers?.length === 0 ? (
          <EmptyState
            title="Couldn't load streams"
            subtitle={error}
          />
        ) : (loading && liveUsers === null) ? (
          <EmptyState title="Loading…" />
        ) : liveUsers && liveUsers.length === 0 ? (
          <EmptyState
            title="No one is live right now."
            subtitle="Check back in a bit."
          />
        ) : (
          <Grid streams={liveUsers ?? []} onPick={(handle) =>
            navigation.navigate("TVStream", { user: handle })
          } />
        )}
      </ScrollView>
    </View>
  );
}

function Grid({
  streams,
  onPick,
}: {
  streams: place.stream.livestream.LivestreamView[];
  onPick: (handle: string) => void;
}) {
  const rows: place.stream.livestream.LivestreamView[][] = [];
  for (let i = 0; i < streams.length; i += COLUMNS) {
    rows.push(streams.slice(i, i + COLUMNS));
  }

  return (
    <View>
      {rows.map((row, rowIdx) => (
        <View
          key={rowIdx}
          style={{
            flexDirection: "row",
            gap: GAP,
            marginBottom: GAP,
          }}
        >
          {row.map((stream, colIdx) => (
            <StreamCard
              key={stream.uri}
              stream={stream}
              firstFocus={rowIdx === 0 && colIdx === 0}
              onPress={() => onPick(stream.author.handle)}
            />
          ))}
          {row.length < COLUMNS &&
            // Spacer so the last row doesn't stretch
            Array.from({ length: COLUMNS - row.length }).map((_, i) => (
              <View key={`pad-${i}`} style={{ flex: 1 }} />
            ))}
        </View>
      ))}
    </View>
  );
}

function StreamCard({
  stream,
  firstFocus,
  onPress,
}: {
  stream: place.stream.livestream.LivestreamView;
  firstFocus?: boolean;
  onPress: () => void;
}) {
  const record = stream.record as { title?: string } | undefined;
  const title = record?.title ?? "Live stream";
  const author =
    stream.author.displayName?.trim() || stream.author.handle;
  const viewers = stream.viewerCount?.count ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <FocusableCard hasTVPreferredFocus={firstFocus} onPress={onPress}>
        <View style={{ aspectRatio: 16 / 9, backgroundColor: "#1a1a22" }}>
          {stream.author.avatar ? (
            <Image
              source={{ uri: stream.author.avatar }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : null}
          <View
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.55)",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: "#ff3b30",
                marginRight: 8,
              }}
            />
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
              LIVE
            </Text>
          </View>
        </View>
      </FocusableCard>
      <View style={{ paddingHorizontal: 4, paddingTop: 12 }}>
        <Text
          numberOfLines={2}
          style={{ color: "#fff", fontSize: 22, fontWeight: "600" }}
        >
          {title}
        </Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 6,
          }}
        >
          <Text numberOfLines={1} style={{ color: "#9aa0a6", fontSize: 16 }}>
            {author}
          </Text>
          <Text style={{ color: "#9aa0a6", fontSize: 16 }}>
            {viewers} watching
          </Text>
        </View>
      </View>
    </View>
  );
}

function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ alignItems: "center", marginTop: 120 }}>
      <Text style={{ color: "#fff", fontSize: 32, fontWeight: "600" }}>
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            color: "#9aa0a6",
            fontSize: 20,
            marginTop: 12,
            textAlign: "center",
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
