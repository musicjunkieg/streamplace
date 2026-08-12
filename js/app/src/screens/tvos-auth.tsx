import { useRoute } from "@react-navigation/native";
import { Text, useStreamplaceStore, useUrl } from "@streamplace/components";
import LoginForm from "components/login/login-form";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "src/navigation-types";
import { useStore } from "store";
import { completeBrowser, SessionBundle } from "../../lib/tvos-auth";

// `https://stream.place/auth/tv?code=ABCD-EFGH` lands here. The user
// signs in to ATProto via the same flow as the rest of the app
// (`<LoginForm />`), then we extract a transferable session bundle and
// POST it to the Streamplace server keyed by the userCode. The TV
// polls and picks it up.

type Phase =
  | { kind: "waiting-login" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function TVOSAuth() {
  const route = useRoute<RootStackParamList, "TVOSAuth">("TVOSAuth");
  const serverUrl = useUrl();
  const oauthSession = useStreamplaceStore((s) => s.oauthSession);
  const authStatus = useStore((s) => s.authStatus);

  const code: string | undefined = route.params?.code;
  const [phase, setPhase] = useState<Phase>({ kind: "waiting-login" });

  const trimmedCode = useMemo(() => (code ?? "").trim().toUpperCase(), [code]);

  // Once the user is logged in (which sets `oauthSession` in the
  // store), automatically submit the bundle.
  useEffect(() => {
    if (!oauthSession || !trimmedCode) return;
    if (phase.kind !== "waiting-login") return;
    submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthSession, trimmedCode]);

  const submit = async () => {
    if (!oauthSession) return;
    setPhase({ kind: "submitting" });
    try {
      const bundle = await extractBundle(oauthSession);
      await completeBrowser(serverUrl, trimmedCode, bundle);
      setPhase({ kind: "done" });
    } catch (e) {
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  if (!trimmedCode) {
    return (
      <Pane>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>
          Missing pairing code
        </Text>
        <Text style={{ fontSize: 15, opacity: 0.7, marginTop: 8 }}>
          This page should be opened from a QR code shown on your Apple TV.
        </Text>
      </Pane>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Pane>
        <Text style={{ fontSize: 28, fontWeight: "700" }}>Pair Apple TV</Text>
        <Text style={{ fontSize: 15, opacity: 0.7, marginTop: 8 }}>
          Pairing code:{" "}
          <Text style={{ fontWeight: "700", letterSpacing: 2 }}>
            {trimmedCode}
          </Text>
        </Text>

        <View
          style={{ height: 1, backgroundColor: "#1a1a22", marginVertical: 24 }}
        />

        {phase.kind === "waiting-login" && authStatus !== "loggedIn" ? (
          <View>
            <Text style={{ fontSize: 16, marginBottom: 16 }}>
              Sign in to Streamplace to continue.
            </Text>
            <LoginForm />
          </View>
        ) : null}

        {phase.kind === "waiting-login" && authStatus === "loggedIn" ? (
          <Pressable
            onPress={submit}
            style={{
              padding: 16,
              backgroundColor: "#2563eb",
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>
              Approve sign-in for this TV
            </Text>
          </Pressable>
        ) : null}

        {phase.kind === "submitting" ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={{ marginLeft: 12 }}>Sending session to your TV…</Text>
          </View>
        ) : null}

        {phase.kind === "done" ? (
          <View>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#48bb78" }}>
              All set!
            </Text>
            <Text style={{ fontSize: 16, marginTop: 8 }}>
              Head back to your Apple TV.
            </Text>
          </View>
        ) : null}

        {phase.kind === "error" ? (
          <View>
            <Text style={{ color: "#ff6b6b", fontSize: 16 }}>
              {phase.message}
            </Text>
            <Pressable
              onPress={submit}
              style={{
                marginTop: 16,
                padding: 14,
                backgroundColor: "#1a1a22",
                borderRadius: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16 }}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
      </Pane>
    </SafeAreaView>
  );
}

function Pane({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, padding: 24 }}>{children}</View>;
}

// Same shape as `pair-tv.tsx` — kept duplicated rather than imported so
// the two screens can evolve independently as the underlying OAuth
// client shape changes between web and native.
async function extractBundle(oauthSession: unknown): Promise<SessionBundle> {
  const s = oauthSession as Record<string, any>;
  const sub: string | undefined = s.sub ?? s.did;
  if (!sub) throw new Error("Active session is missing a DID");
  const tokenSet = s.tokenSet ?? s.session?.tokenSet ?? s;
  const dpopKey = s.dpopKey ?? s.session?.dpopKey;
  const accessToken = tokenSet?.access_token ?? tokenSet?.accessToken;
  if (!accessToken)
    throw new Error("Active session is missing an access token");
  const refreshToken = tokenSet?.refresh_token ?? tokenSet?.refreshToken ?? "";
  const expiresAtRaw =
    tokenSet?.expires_at ?? tokenSet?.accessTokenExpiresAt ?? 0;
  const tokenEndpoint =
    s.serverMetadata?.token_endpoint ??
    s.session?.serverMetadata?.token_endpoint ??
    "";
  let dpopJwk: unknown = undefined;
  if (dpopKey && typeof (dpopKey as any).toJWK === "function") {
    dpopJwk = await (dpopKey as any).toJWK();
  } else if (dpopKey && (dpopKey as any).privateJwk) {
    dpopJwk = (dpopKey as any).privateJwk;
  } else {
    dpopJwk = dpopKey;
  }
  return {
    sub,
    did: sub,
    accessToken,
    accessTokenExpiresAt:
      typeof expiresAtRaw === "number"
        ? expiresAtRaw
        : Date.parse(expiresAtRaw),
    refreshToken,
    tokenEndpoint,
    dpopKey: dpopJwk,
    pdsUrl: s.serverMetadata?.issuer ?? s.session?.serverMetadata?.issuer,
  };
}
