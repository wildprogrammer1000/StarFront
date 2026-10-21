import type { Client, Session } from "@heroiclabs/nakama-js";

/** 기본 닉네임에 붙일 user_id 앞자리 수 */
export const USER_ID_NICK_PREFIX_LEN = 6;

export const NICKNAME_MAX_LEN = 16;

export function defaultNickname(userId: string): string {
  const prefix = userId.replace(/-/g, "").slice(0, USER_ID_NICK_PREFIX_LEN);
  return `플레이어${prefix}`;
}

function normalizeNickname(raw: string | undefined, userId: string): string {
  const trimmed = (raw ?? "").trim().slice(0, NICKNAME_MAX_LEN);
  return trimmed || defaultNickname(userId);
}

/** 계정 display_name이 비어 있으면 기본 닉네임으로 채운다. */
export async function ensureAccountDisplayName(
  client: Client,
  session: Session
): Promise<string> {
  const account = await client.getAccount(session);
  const userId = account.user?.id ?? session.user_id ?? "";
  const current = account.user?.display_name?.trim();
  if (current) return current.slice(0, NICKNAME_MAX_LEN);

  const nick = defaultNickname(userId);
  await client.updateAccount(session, { display_name: nick });
  return nick;
}

export async function updateAccountDisplayName(
  client: Client,
  session: Session,
  nickname: string
): Promise<string> {
  const userId = session.user_id ?? "";
  const next = normalizeNickname(nickname, userId);
  await client.updateAccount(session, { display_name: next });
  return next;
}
