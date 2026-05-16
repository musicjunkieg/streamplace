import { useNavigation } from "@react-navigation/native";
import { Text, useUrl } from "@streamplace/components";
import { QRCode } from "components/tv/qr-code";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import {
  awaitTVAuth,
  persistBundle,
  startTVAuth,
  TVAuthStart,
} from "../../lib/tvos-auth";

type Phase =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "waiting"; start: TVAuthStart }
  | { kind: "success" }
  | { kind: "failed"; message: string };

export default function LoginTV() {
  const navigation = useNavigation<any>();
  const serverUrl = useUrl();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const begin = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase({ kind: "starting" });
    try {
      const start = await startTVAuth(serverUrl);
      setPhase({ kind: "waiting", start });
      const bundle = await awaitTVAuth(serverUrl, start.sessionId, ctrl.signal);
      await persistBundle(bundle);
      setPhase({ kind: "success" });
      // Brief pause so the user sees the success flash, then go home.
      setTimeout(() => navigation.navigate("TVHome"), 800);
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === "AbortError") return;
      const message = e instanceof Error ? e.message : String(e);
      setPhase({ kind: "failed", message });
    }
  };

  useEffect(() => {
    begin();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0b0b0e",
        padding: 80,
        flexDirection: "row",
      }}
    >
      <View style={{ flex: 1, justifyContent: "center", paddingRight: 60 }}>
        <Text style={{ color: "#fff", fontSize: 64, fontWeight: "700" }}>
          Sign in to Streamplace
        </Text>
        <Text
          style={{
            color: "#9aa0a6",
            fontSize: 24,
            marginTop: 18,
            lineHeight: 32,
          }}
        >
          Scan the QR with your phone, or open Streamplace on your phone and
          tap{" "}
          <Text style={{ color: "#fff", fontWeight: "600" }}>Pair Apple TV</Text>
          .
        </Text>

        <View style={{ marginTop: 40 }}>
          {phase.kind === "waiting" ? (
            <CodeBlock code={phase.start.userCode} />
          ) : null}
        </View>

        <View style={{ marginTop: 40 }}>
          <PhaseStatus phase={phase} onRetry={begin} />
        </View>

        <Pressable
          onPress={() => navigation.navigate("TVHome")}
          style={{
            marginTop: 60,
            paddingVertical: 16,
            paddingHorizontal: 28,
            backgroundColor: "#1a1a22",
            borderRadius: 12,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 18 }}>
            Continue without signing in
          </Text>
        </Pressable>
      </View>

      <View
        style={{
          width: 460,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {phase.kind === "waiting" ? (
          <QRPanel url={phase.start.qrUrl} />
        ) : (
          <QRPlaceholder />
        )}
      </View>
    </View>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
      }}
    >
      <Text style={{ color: "#9aa0a6", fontSize: 18, marginRight: 12 }}>
        Your code:
      </Text>
      <Text
        style={{
          color: "#fff",
          fontSize: 48,
          fontWeight: "700",
          letterSpacing: 4,
        }}
      >
        {code}
      </Text>
    </View>
  );
}

function PhaseStatus({
  phase,
  onRetry,
}: {
  phase: Phase;
  onRetry: () => void;
}) {
  if (phase.kind === "starting") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <ActivityIndicator color="#fff" />
        <Text style={{ color: "#9aa0a6", fontSize: 18, marginLeft: 12 }}>
          Requesting a code…
        </Text>
      </View>
    );
  }
  if (phase.kind === "waiting") {
    return (
      <Text style={{ color: "#9aa0a6", fontSize: 18 }}>
        Waiting for sign-in… You can close this once you've signed in on your
        phone.
      </Text>
    );
  }
  if (phase.kind === "success") {
    return (
      <Text style={{ color: "#48bb78", fontSize: 22, fontWeight: "600" }}>
        Signed in. Sending you to the home screen.
      </Text>
    );
  }
  if (phase.kind === "failed") {
    return (
      <View>
        <Text style={{ color: "#ff6b6b", fontSize: 18 }}>{phase.message}</Text>
        <Pressable
          onPress={onRetry}
          style={{
            marginTop: 12,
            paddingVertical: 12,
            paddingHorizontal: 22,
            backgroundColor: "#2563eb",
            borderRadius: 10,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 18 }}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  return null;
}

function QRPanel({ url }: { url: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          padding: 18,
          backgroundColor: "#fff",
          borderRadius: 18,
        }}
      >
        <QRCode value={url} size={360} />
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: "#9aa0a6",
          fontSize: 14,
          marginTop: 18,
          maxWidth: 420,
        }}
      >
        {url}
      </Text>
    </View>
  );
}

function QRPlaceholder() {
  return (
    <View
      style={{
        width: 396,
        height: 396,
        backgroundColor: "#16161c",
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color="#fff" />
    </View>
  );
}
