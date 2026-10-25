const NICKNAME_MAX_LEN = 16;

function fail(error: string): string {
  return JSON.stringify({ ok: false, error: error });
}

/** 다른 계정과 겹치지 않을 때만 display_name 을 바꾼다. */
export function rpcUpdateNickname(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  const userId = ctx.userId || "";
  if (!userId) return fail("로그인이 필요합니다.");

  let nickname = "";
  if (payload) {
    try {
      const req = JSON.parse(payload) as { nickname?: unknown };
      if (typeof req.nickname === "string") nickname = req.nickname;
    } catch (_err) {
      return fail("닉네임을 확인하지 못했습니다.");
    }
  }
  const name = nickname.trim().slice(0, NICKNAME_MAX_LEN);
  if (!name) return fail("닉네임을 입력하세요.");

  let rows: { [key: string]: unknown }[] = [];
  try {
    rows = nk.sqlQuery(
      "SELECT id::text AS id FROM users WHERE lower(btrim(display_name)) = lower(btrim($1)) AND id <> $2::uuid LIMIT 1",
      [name, userId]
    );
  } catch (err) {
    logger.error("nickname lookup failed: %s", String(err));
    return fail("닉네임 확인에 실패했습니다.");
  }
  if (rows && rows.length > 0) return fail("이미 사용 중인 닉네임입니다.");

  const found = nk.usersGetId([userId]);
  const user = found && found.length > 0 ? found[0] : null;
  const username = user && user.username ? user.username : "";
  const langTag =
    user && (user.langTag || user.lang_tag)
      ? String(user.langTag || user.lang_tag)
      : "en";
  const timezone = user && user.timezone ? String(user.timezone) : "";
  const location = user && user.location ? String(user.location) : "";
  const avatarUrl =
    user && (user.avatarUrl || user.avatar_url)
      ? String(user.avatarUrl || user.avatar_url)
      : "";

  try {
    nk.accountUpdateId(
      userId,
      username,
      name,
      timezone,
      location,
      langTag,
      avatarUrl,
      null
    );
  } catch (err) {
    logger.error("nickname update failed: %s", String(err));
    return fail("닉네임을 바꾸지 못했습니다.");
  }
  return JSON.stringify({ ok: true, nickname: name });
}
