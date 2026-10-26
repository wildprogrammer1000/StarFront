import { BOT_USER_ID } from "../sim/bot";
import { bindMatchSim, createMatchSim, type MatchSim } from "../sim/MatchSim";
import type { PlayerInput, Side } from "../protocol/index";
import { OpCode } from "../protocol/opcodes";
import { deleteRoom, updateRoomStatus } from "../rooms/roomStore";
import { COUNTDOWN_SEC, TICK_HZ } from "../sim/constants";

export interface MatchState {
  sim: MatchSim;
  joinOrder: string[];
  inviteCode: string;
  roomSyncedPlaying: boolean;
  vsBot: boolean;
}

function hydrate(state: unknown): MatchState {
  const s = state as MatchState;
  if (!s.joinOrder) s.joinOrder = [];
  if (typeof s.inviteCode !== "string") s.inviteCode = "";
  if (typeof s.roomSyncedPlaying !== "boolean") s.roomSyncedPlaying = false;
  if (typeof s.vsBot !== "boolean") s.vsBot = false;
  s.sim = bindMatchSim(s.sim || {});
  return s;
}

function presenceUserId(presence: nkruntime.Presence | undefined | null): string {
  if (!presence) return "";
  const p = presence as nkruntime.Presence & { user_id?: string };
  return p.userId || p.user_id || "";
}

function decodeInput(nk: nkruntime.Nakama, data: unknown): PlayerInput | null {
  if (data == null || data === "") return null;
  try {
    let text = "";
    if (typeof data === "string") {
      text = data;
    } else if (typeof nk.binaryToString === "function") {
      text = nk.binaryToString(data as ArrayBuffer);
    } else {
      const bytes = new Uint8Array(data as ArrayBuffer);
      for (let i = 0; i < bytes.length; i++) {
        text += String.fromCharCode(bytes[i]);
      }
    }
    if (!text) return null;
    return JSON.parse(text) as PlayerInput;
  } catch (_e) {
    return null;
  }
}

function encodeJson(value: unknown): string {
  return JSON.stringify(value);
}

function playerLabel(
  nk: nkruntime.Nakama,
  userId: string,
  username: string
): string {
  try {
    const users = nk.usersGetId([userId]);
    if (users && users.length > 0) {
      const user = users[0] as nkruntime.User & { display_name?: string };
      const display = (user.displayName || user.display_name || "").trim();
      if (display) return display.slice(0, 16);
      if (user.username) return user.username;
    }
  } catch (_err) {
    /* 계정 조회 실패 시 presence username */
  }
  return (username || "").trim().slice(0, 16);
}

function assignSide(joinOrder: string[], userId: string): Side {
  const idx = joinOrder.indexOf(userId);
  return idx === 0 ? "bottom" : "top";
}

/**
 * 대기실에서만 입장 순서로 side를 다시 맞춘다.
 * 전투 중에는 쓰면 안 된다. 선두가 나가면 남은 top이 bottom이 되고,
 * 클라이언트 카메라가 상대 진영 시점으로 뒤집힌다.
 */
function reassignSides(s: MatchState): void {
  for (let i = 0; i < s.joinOrder.length; i++) {
    const userId = s.joinOrder[i];
    const player = s.sim.players[userId];
    if (player) {
      player.side = i === 0 ? "bottom" : "top";
    }
  }
}

function syncRoomPlayers(nk: nkruntime.Nakama, s: MatchState): void {
  if (!s.inviteCode) return;
  updateRoomStatus(nk, s.inviteCode, "waiting", s.joinOrder.length);
}

function countHumans(s: MatchState): number {
  let n = 0;
  for (let i = 0; i < s.joinOrder.length; i++) {
    if (s.joinOrder[i] !== BOT_USER_ID) n += 1;
  }
  return n;
}

function seatBot(s: MatchState): void {
  if (!s.vsBot) return;
  if (s.joinOrder.indexOf(BOT_USER_ID) >= 0) return;
  s.joinOrder.push(BOT_USER_ID);
  s.sim.addPlayer(BOT_USER_ID, "", "top", "컴퓨터");
}

function refreshHost(s: MatchState): void {
  if (s.joinOrder.length > 0) {
    s.sim.setHost(s.joinOrder[0]);
  } else {
    s.sim.setHost("");
  }
}

export function matchInit(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  params: { [key: string]: string }
) {
  const inviteCode = (params.inviteCode || "").toUpperCase();
  const hostUserId = params.hostUserId || "";
  const roomName = params.name || "";
  logger.info("starfront matchInit invite=%s", inviteCode || "-");
  const state: MatchState = {
    sim: createMatchSim({
      hostUserId: hostUserId,
      roomName: roomName,
      inviteCode: inviteCode,
    }),
    joinOrder: [],
    inviteCode: inviteCode,
    roomSyncedPlaying: false,
    vsBot: params.vsBot === "1",
  };
  return {
    state: state,
    tickRate: TICK_HZ,
    label: JSON.stringify({
      open: true,
      needed: 2,
      inviteCode: inviteCode,
      isPublic: params.isPublic === "1",
      name: roomName,
    }),
  };
}

export function matchJoinAttempt(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  _dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: unknown,
  presence: nkruntime.Presence,
  _metadata: { [key: string]: unknown }
) {
  const s = hydrate(state);
  if (s.sim.status !== "waiting") {
    logger.warn("match not waiting, reject %s", presence.userId);
    return { state: s, accept: false, rejectMessage: "match_started" };
  }
  if (s.joinOrder.length >= 2 && s.joinOrder.indexOf(presence.userId) < 0) {
    logger.warn("match full, reject %s", presence.userId);
    return { state: s, accept: false, rejectMessage: "match_full" };
  }
  return { state: s, accept: true };
}

export function matchJoin(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: unknown,
  presences: nkruntime.Presence[]
) {
  const s = hydrate(state);
  for (let i = 0; i < presences.length; i++) {
    const p = presences[i];
    if (s.joinOrder.indexOf(p.userId) < 0) {
      s.joinOrder.push(p.userId);
    }
    const side = assignSide(s.joinOrder, p.userId);
    s.sim.addPlayer(
      p.userId,
      p.sessionId,
      side,
      playerLabel(nk, p.userId, p.username)
    );
    logger.info("join %s side=%s", p.userId, side);
  }
  seatBot(s);
  reassignSides(s);
  refreshHost(s);
  syncRoomPlayers(nk, s);
  dispatcher.broadcastMessage(OpCode.SNAPSHOT, encodeJson(s.sim.snapshot()));
  return { state: s };
}

export function matchLeave(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: unknown,
  presences: nkruntime.Presence[]
) {
  const s = hydrate(state);
  const wasPlaying = s.sim.status === "playing";
  for (let i = 0; i < presences.length; i++) {
    const p = presences[i];
    s.sim.removePlayer(p.userId);
    const idx = s.joinOrder.indexOf(p.userId);
    if (idx >= 0) s.joinOrder.splice(idx, 1);
    logger.info("leave %s", p.userId);
  }

  if (!wasPlaying && countHumans(s) === 0) {
    if (s.inviteCode) {
      deleteRoom(nk, s.inviteCode);
      logger.info("room destroyed (empty) code=%s", s.inviteCode);
    }
    return null;
  }

  if (wasPlaying) {
    // 건물 side는 그대로라, 플레이어 side만 바꾸면 아군이 적으로 보인다.
    if (s.joinOrder.length === 1) {
      const winnerId = s.joinOrder[0];
      const winner = s.sim.players[winnerId];
      s.sim.status = "ended";
      s.sim.winnerSide = winner ? winner.side : "draw";
      logger.info(
        "forfeit winner=%s side=%s",
        winnerId,
        s.sim.winnerSide || "-"
      );
    }
    refreshHost(s);
    dispatcher.broadcastMessage(OpCode.SNAPSHOT, encodeJson(s.sim.snapshot()));
    return { state: s };
  }

  reassignSides(s);
  refreshHost(s);
  if (s.sim.status === "waiting" || s.sim.status === "countdown") {
    syncRoomPlayers(nk, s);
  }
  dispatcher.broadcastMessage(OpCode.SNAPSHOT, encodeJson(s.sim.snapshot()));
  return { state: s };
}

export function matchLoop(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: unknown,
  messages: nkruntime.MatchData[]
) {
  const s = hydrate(state);
  const prevStatus = s.sim.status;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as nkruntime.MatchData & {
      op_code?: number;
      sender?: nkruntime.Presence;
    };
    if (!msg) continue;
    const opRaw = msg.opCode != null ? msg.opCode : msg.op_code;
    const op = typeof opRaw === "number" ? opRaw : Number(opRaw);
    if (op !== OpCode.INPUT) continue;

    const presence = msg.presence || msg.sender;
    const userId = presenceUserId(presence);
    if (!userId) {
      logger.warn("input missing presence, skip");
      continue;
    }
    const input = decodeInput(nk, msg.data);
    if (!input) {
      logger.warn("bad input from %s", userId);
      continue;
    }

    if (input.type === "set_bot_race") {
      refreshHost(s);
      const hostId = s.joinOrder.length > 0 ? s.joinOrder[0] : s.sim.hostUserId;
      const bot = s.sim.players[BOT_USER_ID];
      const race = input.race;
      const known = race === "human" || race === "monster" || race === "alien";
      if (
        s.vsBot &&
        s.sim.status === "waiting" &&
        userId === hostId &&
        bot &&
        known
      ) {
        bot.race = race;
        logger.info("bot race=%s by %s", race, userId);
      }
      continue;
    }

    if (input.type === "host_start") {
      refreshHost(s);
      const hostId = s.joinOrder.length > 0 ? s.joinOrder[0] : s.sim.hostUserId;
      if (userId !== hostId) {
        logger.warn(
          "host_start rejected user=%s host=%s",
          userId,
          hostId || "-"
        );
        continue;
      }
      if (s.joinOrder.length < 2) {
        logger.warn(
          "host_start rejected (need 2 players, have %d)",
          s.joinOrder.length
        );
        continue;
      }
      if (s.sim.status !== "waiting") {
        logger.warn(
          "host_start rejected status=%s",
          s.sim.status
        );
        continue;
      }
      // 필드 직접 설정 — 메서드 바인딩 이슈 방지
      s.sim.status = "countdown";
      s.sim.countdownLeft = COUNTDOWN_SEC;
      logger.info(
        "countdown started user=%s players=%d",
        userId,
        s.joinOrder.length
      );
      continue;
    }

    s.sim.applyInput(userId, input);
  }

  if (s.sim.status === "countdown" || s.sim.status === "playing") {
    s.sim.step();
  }

  if (s.sim.status === "playing") {
    if (!s.roomSyncedPlaying && s.inviteCode) {
      updateRoomStatus(nk, s.inviteCode, "playing", s.joinOrder.length);
      s.roomSyncedPlaying = true;
    }
  } else if (
    prevStatus === "countdown" &&
    s.sim.status === "waiting" &&
    s.inviteCode
  ) {
    syncRoomPlayers(nk, s);
  }

  dispatcher.broadcastMessage(OpCode.SNAPSHOT, encodeJson(s.sim.snapshot()));

  if (s.sim.status === "ended") {
    dispatcher.broadcastMessage(
      OpCode.MATCH_END,
      encodeJson({
        winnerSide: s.sim.winnerSide,
        snapshot: s.sim.snapshot(),
      })
    );
    if (s.inviteCode) {
      deleteRoom(nk, s.inviteCode);
      logger.info("room destroyed (match_ended) code=%s", s.inviteCode);
    }
    return null;
  }

  return { state: s };
}

export function matchTerminate(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: unknown,
  _graceSeconds: number
) {
  const s = hydrate(state);
  if (s.inviteCode) {
    deleteRoom(nk, s.inviteCode);
    logger.info("room destroyed (terminate) code=%s", s.inviteCode);
  }
  logger.info("matchTerminate");
  return { state: s };
}

export function matchSignal(
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  _dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: unknown,
  data: string
) {
  return { state: hydrate(state), data: data };
}
