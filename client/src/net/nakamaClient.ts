import { Client, Session, Socket } from "@heroiclabs/nakama-js";
import { v4 as uuidv4 } from "uuid";

const CUSTOM_ID_KEY = "starfront_custom_id";
const SESSION_KEY = "starfront_session";
/** nakama-js Client.expiredTimespanMs 와 동일 — 만료 임박 시 refresh */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

function env(name: string, fallback: string): string {
  return (import.meta.env[name] as string | undefined) ?? fallback;
}

export function createNakamaClient(): Client {
  const useSSL = env("VITE_NAKAMA_USE_SSL", "false") === "true";
  return new Client(
    env("VITE_NAKAMA_SERVER_KEY", "defaultkey"),
    env("VITE_NAKAMA_HOST", "127.0.0.1"),
    env("VITE_NAKAMA_PORT", "7350"),
    useSSL
  );
}

/**
 * 탭마다 별도 게스트 계정 — 같은 브라우저 두 탭으로 1v1 빠른 대전 테스트 가능.
 * (localStorage면 탭이 동일 userId라 Nakama 매치메이커가 매칭하지 않음)
 */
function getOrCreateCustomId(): string {
  let id = sessionStorage.getItem(CUSTOM_ID_KEY);
  if (!id) {
    id = uuidv4();
    sessionStorage.setItem(CUSTOM_ID_KEY, id);
  }
  return id;
}

function persistSession(session: Session): void {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      token: session.token,
      refresh_token: session.refresh_token,
    })
  );
}

export function clearStoredSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function isAuthError(err: unknown): boolean {
  const e = err as {
    status?: number;
    statusCode?: number;
    code?: number;
    message?: string;
  };
  const status = e?.status ?? e?.statusCode ?? e?.code;
  if (status === 401 || status === 403) return true;
  const msg = String(e?.message ?? err);
  return /401|unauthorized|unauthorised|refresh/i.test(msg);
}

function needsRefresh(session: Session): boolean {
  return session.isexpired((Date.now() + REFRESH_SKEW_MS) / 1000);
}

async function loginFresh(client: Client): Promise<Session> {
  const customId = getOrCreateCustomId();
  const session = await client.authenticateCustom(customId, true);
  persistSession(session);
  return session;
}

/** 저장된 세션 복원 → 필요 시 refresh → 실패하면 재로그인 */
export async function authenticateGuest(client: Client): Promise<Session> {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as {
        token?: string;
        refresh_token?: string;
      };
      if (parsed.token && parsed.refresh_token) {
        const session = Session.restore(parsed.token, parsed.refresh_token);
        const now = Date.now() / 1000;
        if (session.isrefreshexpired(now)) {
          clearStoredSession();
        } else if (!needsRefresh(session)) {
          return session;
        } else {
          try {
            await client.sessionRefresh(session);
            persistSession(session);
            return session;
          } catch {
            clearStoredSession();
          }
        }
      } else {
        clearStoredSession();
      }
    } catch {
      clearStoredSession();
    }
  }
  return loginFresh(client);
}

export async function connectSocket(
  client: Client,
  session: Session
): Promise<Socket> {
  // createSocket(useSSL) 기본값은 false — Client.useSSL 을 넘기지 않으면
  // HTTPS 페이지에서 ws:// 혼합콘텐츠 오류가 난다.
  const socket = client.createSocket(client.useSSL);
  await socket.connect(session, true);
  return socket;
}

/** HMR / StrictMode 리마운트에도 소켓을 유지해 매칭·전투가 끊기지 않게 한다. */
type LiveConnection = { session: Session; socket: Socket };

let live: LiveConnection | null = null;
let liveBoot: Promise<LiveConnection> | null = null;
type ConnectionListener = (conn: LiveConnection) => void;
const connectionListeners = new Set<ConnectionListener>();

export function onConnectionChange(listener: ConnectionListener): () => void {
  connectionListeners.add(listener);
  return () => {
    connectionListeners.delete(listener);
  };
}

function notifyConnection(conn: LiveConnection): void {
  connectionListeners.forEach((fn) => {
    try {
      fn(conn);
    } catch {
      // ignore listener errors
    }
  });
}

function socketAlive(socket: Socket): boolean {
  const adapter = (socket as Socket & { adapter?: { isOpen?: () => boolean } })
    .adapter;
  if (adapter && typeof adapter.isOpen === "function") {
    return adapter.isOpen();
  }
  return true;
}

async function refreshLiveSession(
  client: Client,
  session: Session
): Promise<Session> {
  if (!needsRefresh(session)) return session;
  const now = Date.now() / 1000;
  if (session.isrefreshexpired(now)) {
    throw new Error("refresh token expired");
  }
  await client.sessionRefresh(session);
  persistSession(session);
  return session;
}

export async function ensureConnection(
  client: Client
): Promise<LiveConnection> {
  if (live && socketAlive(live.socket)) {
    try {
      live.session = await refreshLiveSession(client, live.session);
      return live;
    } catch {
      try {
        live.socket.disconnect(false);
      } catch {
        // already closed
      }
      live = null;
      clearStoredSession();
    }
  }
  if (liveBoot) {
    return liveBoot;
  }

  liveBoot = (async () => {
    if (live?.socket) {
      try {
        live.socket.disconnect(false);
      } catch {
        // already closed
      }
      live = null;
    }
    const session = await authenticateGuest(client);
    const socket = await connectSocket(client, session);
    live = { session, socket };
    notifyConnection(live);
    return live;
  })();

  try {
    return await liveBoot;
  } finally {
    liveBoot = null;
  }
}

/** 401 등 인증 실패 후 강제 재로그인 (커스텀 ID는 유지) */
export async function recoverConnection(
  client: Client
): Promise<LiveConnection> {
  clearStoredSession();
  if (live?.socket) {
    try {
      live.socket.disconnect(false);
    } catch {
      // ignore
    }
  }
  live = null;
  liveBoot = null;
  return ensureConnection(client);
}

export function resetConnection(): void {
  if (live?.socket) {
    try {
      live.socket.disconnect(false);
    } catch {
      // ignore
    }
  }
  live = null;
  liveBoot = null;
}
