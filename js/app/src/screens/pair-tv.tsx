import { useNavigation, useRoute } from "@react-navigation/native";
import { Text, useStreamplaceStore, useUrl } from "@streamplace/components";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import type { RootStackParamList } from "src/navigation-types";
import { completeMobile, SessionBundle } from "../../lib/tvos-auth";

// Reuses the phone's currently-active ATProto session to complete a TV
// pairing flow. The user enters the userCode shown on their Apple TV,
// hits "Pair", and we POST the session bundle to the server. The TV's
// poll picks it up.

export default function PairTV() {
  const navigation = useNavigation();
  const route = useRoute<RootStackParamList, "PairTV">("PairTV");
  const serverUrl = useUrl();
  const oauthSession = useStreamplaceStore((s) => s.oauthSession);

  const [code, setCode] = useState<string>(route.params?.code ?? "");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "done" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const trimmedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  if (!oauthSession) {
    return (
      <Pane>
        <Text style={{ fontSize: 20 }}>
          You need to sign in on this device before you can pair an Apple TV.
        </Text>
      </Pane>
    );
  }

  const submit = async () => {
    if (!trimmedCode) return;
    setStatus({ kind: "submitting" });
    try {
      const bundle = await extractBundle(oauthSession);
      await completeMobile(serverUrl, trimmedCode, bundle);
      setStatus({ kind: "done" });
      setTimeout(() => navigation.goBack(), 1500);
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <Pane>
      <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 8 }}>
        Pair Apple TV
      </Text>
      <Text style={{ fontSize: 15, opacity: 0.7, marginBottom: 24 }}>
        Open Streamplace on your Apple TV, choose "Sign in", and enter the code
        it shows you below.
      </Text>

      <TextInput
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        value={code}
        onChangeText={setCode}
        onSubmitEditing={submit}
        placeholder="ABCD-EFGH"
        placeholderTextColor="#9aa0a6"
        style={{
          fontSize: 28,
          letterSpacing: 4,
          padding: 14,
          borderWidth: 1,
          borderColor: "#444",
          borderRadius: 12,
          textAlign: "center",
        }}
      />

      <Pressable
        onPress={submit}
        disabled={status.kind === "submitting" || !trimmedCode}
        style={{
          marginTop: 24,
          padding: 16,
          backgroundColor: trimmedCode ? "#2563eb" : "#3a3a44",
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        {status.kind === "submitting" ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>
            Pair
          </Text>
        )}
      </Pressable>

      {status.kind === "done" ? (
        <Text style={{ marginTop: 18, color: "#48bb78", fontSize: 16 }}>
          Done — head back to your Apple TV.
        </Text>
      ) : null}
      {status.kind === "error" ? (
        <Text style={{ marginTop: 18, color: "#ff6b6b", fontSize: 16 }}>
          {status.message}
        </Text>
      ) : null}
    </Pane>
  );
}

function Pane({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

// Pull out the transferable bits from an OAuthSession. The shape on the
// wire below matches `SessionBundle` in `lib/tvos-auth.ts`. We export
// just enough for the receiving TV to reconstruct an authenticated
// agent; refresh continues to work because the DPoP private key
// travels with the bundle.
async function extractBundle(oauthSession: unknown): Promise<SessionBundle> {
  // `@atproto/oauth-client` Session shape — fields are read defensively
  // because the underlying class differs slightly between browser and
  // expo OAuth client implementations.
  const s = oauthSession as Record<string, any>;
  const sub: string | undefined = s.sub ?? s.did;
  if (!sub) {
    throw new Error("Active session is missing a DID");
  }
  const tokenSet = s.tokenSet ?? s.session?.tokenSet ?? s;
  const dpopKey = s.dpopKey ?? s.session?.dpopKey;
  if (!tokenSet?.access_token && !tokenSet?.accessToken) {
    throw new Error("Active session is missing an access token");
  }
  const accessToken = tokenSet.access_token ?? tokenSet.accessToken;
  const refreshToken = tokenSet.refresh_token ?? tokenSet.refreshToken ?? "";
  const expiresAtRaw =
    tokenSet.expires_at ?? tokenSet.accessTokenExpiresAt ?? 0;
  const tokenEndpoint =
    s.serverMetadata?.token_endpoint ??
    s.session?.serverMetadata?.token_endpoint ??
    "";
  // Export the DPoP key as a plain JWK — the OAuth client stores it as
  // a CryptoKey/JoseKey instance, but every implementation supports
  // serializing back to JWK for transfer.
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
