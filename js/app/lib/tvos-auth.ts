import { storage } from "@streamplace/components";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_DURATION_MS = 10 * 60 * 1000;

// Shape exposed by `POST /api/tvos-auth/start` on the Streamplace server.
export interface TVAuthStart {
  sessionId: string;
  userCode: string;
  qrUrl: string;
  expiresAt: string;
}

// Status returned by `GET /api/tvos-auth/{sessionId}` while polling.
export type TVAuthStatus =
  | { status: "pending" }
  | { status: "ready"; session: SessionBundle }
  | { status: "expired" };

// The transferable shape of an ATProto OAuth session — exactly what the
// receiving device (the TV) needs to construct an authenticated agent
// and refresh tokens going forward.
export interface SessionBundle {
  sub: string;
  did: string;
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
  tokenEndpoint: string;
  dpopKey: unknown; // JWK
  dpopKeyId?: string;
  // The PDS server URL is needed for the OAuth client to know which
  // resource server to talk to. Bundled for convenience.
  pdsUrl?: string;
}

export async function startTVAuth(serverUrl: string): Promise<TVAuthStart> {
  const res = await fetch(`${serverUrl}/api/tvos-auth/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`tvos-auth/start failed: ${res.status}`);
  }
  return (await res.json()) as TVAuthStart;
}

export async function pollTVAuth(
  serverUrl: string,
  sessionId: string,
): Promise<TVAuthStatus> {
  const res = await fetch(
    `${serverUrl}/api/tvos-auth/${encodeURIComponent(sessionId)}`,
  );
  if (res.status === 404) {
    return { status: "expired" };
  }
  if (!res.ok) {
    throw new Error(`tvos-auth poll failed: ${res.status}`);
  }
  return (await res.json()) as TVAuthStatus;
}

export async function completeBrowser(
  serverUrl: string,
  sessionId: string,
  bundle: SessionBundle,
): Promise<void> {
  const res = await fetch(
    `${serverUrl}/api/tvos-auth/${encodeURIComponent(sessionId)}/complete-browser`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(bundle),
    },
  );
  if (!res.ok) {
    throw new Error(`complete-browser failed: ${res.status}`);
  }
}

export async function completeMobile(
  serverUrl: string,
  userCodeOrSessionId: string,
  bundle: SessionBundle,
): Promise<void> {
  const res = await fetch(
    `${serverUrl}/api/tvos-auth/${encodeURIComponent(userCodeOrSessionId)}/complete-mobile`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(bundle),
    },
  );
  if (!res.ok) {
    throw new Error(`complete-mobile failed: ${res.status}`);
  }
}

/**
 * Poll until the auth session completes, expires, or the caller cancels.
 * Resolves with the SessionBundle on success.
 */
export async function awaitTVAuth(
  serverUrl: string,
  sessionId: string,
  signal: AbortSignal,
): Promise<SessionBundle> {
  const start = Date.now();
  while (Date.now() - start < POLL_MAX_DURATION_MS) {
    if (signal.aborted) {
      throw new DOMException("aborted", "AbortError");
    }
    const status = await pollTVAuth(serverUrl, sessionId);
    if (status.status === "ready") return status.session;
    if (status.status === "expired") {
      throw new Error("Pairing session expired. Try again.");
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Pairing timed out.");
}

const TV_BUNDLE_KEY = "streamplace.tv.session-bundle";

/**
 * Persist a transferred bundle locally so the TV can rehydrate the
 * ATProto session on subsequent launches. We don't construct an OAuth
 * client on the TV; we use the SessionManager primitives via the same
 * keys the rest of the app expects. See `js/components/src/storage/`
 * for the underlying expo-sqlite kv-store.
 */
export async function persistBundle(bundle: SessionBundle): Promise<void> {
  await storage.setItem(TV_BUNDLE_KEY, JSON.stringify(bundle));
}

export async function loadBundle(): Promise<SessionBundle | null> {
  const raw = await storage.getItem(TV_BUNDLE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionBundle;
  } catch {
    return null;
  }
}

export async function clearBundle(): Promise<void> {
  await storage.removeItem(TV_BUNDLE_KEY);
}
