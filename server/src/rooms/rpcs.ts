import { MATCH_MODULE } from "../match/constants";
import {
  cleanupStaleRooms,
  deleteRoom,
  generateInviteCode,
  listPublicWaitingRooms,
  matchAliveSafe,
  readRoomByCode,
  writeRoom,
} from "./roomStore";
import type {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  ListRoomsResponse,
  RoomRecord,
} from "./types";

function parsePayload<T>(payload: string): T {
  if (!payload || payload === "") {
    return {} as T;
  }
  return JSON.parse(payload) as T;
}

export function rpcCreateRoom(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  cleanupStaleRooms(nk, logger);

  const req = parsePayload<CreateRoomRequest>(payload);
  const vsBot = req.vsBot === true;
  const name = vsBot
    ? "AI 대전"
    : (req.name || "StarFront Room").trim().slice(0, 32) || "StarFront Room";
  const isPublic = vsBot ? false : req.isPublic !== false;

  const inviteCode = generateInviteCode(nk);
  const roomId = inviteCode;
  const matchId = nk.matchCreate(MATCH_MODULE, {
    roomId: roomId,
    inviteCode: inviteCode,
    isPublic: isPublic ? "1" : "0",
    name: name,
    hostUserId: ctx.userId,
    vsBot: vsBot ? "1" : "0",
  });

  const room: RoomRecord = {
    roomId: roomId,
    matchId: matchId,
    inviteCode: inviteCode,
    name: name,
    isPublic: isPublic,
    hostUserId: ctx.userId,
    status: "waiting",
    maxPlayers: 2,
    playerCount: 0,
    createdAt: Date.now(),
  };
  writeRoom(nk, room);
  logger.info(
    "room created code=%s public=%s match=%s host=%s",
    inviteCode,
    String(isPublic),
    matchId,
    ctx.userId
  );

  const res: CreateRoomResponse = { room: room };
  return JSON.stringify(res);
}

export function rpcListRooms(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string
): string {
  cleanupStaleRooms(nk, logger);
  const rooms = listPublicWaitingRooms(nk);
  const res: ListRoomsResponse = { rooms: rooms };
  return JSON.stringify(res);
}

export function rpcJoinRoomByCode(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  cleanupStaleRooms(nk, logger);

  const req = parsePayload<JoinRoomRequest>(payload);
  const code = (req.inviteCode || "").trim().toUpperCase();
  if (!code) {
    throw new Error("invite_code_required");
  }

  const room = readRoomByCode(nk, code);
  if (!room) {
    throw new Error("room_not_found");
  }
  if (room.status === "closed") {
    deleteRoom(nk, room.inviteCode);
    throw new Error("room_closed");
  }
  if (room.status === "playing") {
    throw new Error("room_already_started");
  }
  if (room.playerCount >= room.maxPlayers) {
    throw new Error("room_full");
  }
  if (!matchAliveSafe(nk, room.matchId)) {
    deleteRoom(nk, room.inviteCode);
    throw new Error("room_not_found");
  }

  logger.info("join by code=%s match=%s", code, room.matchId);
  const res: JoinRoomResponse = { room: room };
  return JSON.stringify(res);
}

export function rpcCleanupRooms(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string
): string {
  const deleted = cleanupStaleRooms(nk, logger);
  return JSON.stringify({ deleted: deleted });
}

/**
 * 빠른 시작: 자리가 남은 공개 대기실에 입장하고, 없으면 빈 방을 만든다.
 * 1인 대기 방을 우선해 두 번째 플레이어가 바로 합류하게 한다.
 */
export function rpcQuickJoin(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string
): string {
  cleanupStaleRooms(nk, logger);

  const rooms = listPublicWaitingRooms(nk);
  let picked: RoomRecord | null = null;

  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    if (room.playerCount >= room.maxPlayers) continue;
    if (!matchAliveSafe(nk, room.matchId)) continue;
    if (room.playerCount === 1) {
      picked = room;
      break;
    }
    if (!picked && room.playerCount === 0) {
      picked = room;
    }
  }

  if (picked) {
    logger.info(
      "quick_join existing code=%s players=%d",
      picked.inviteCode,
      picked.playerCount
    );
    const res: JoinRoomResponse = { room: picked };
    return JSON.stringify(res);
  }

  logger.info("quick_join create empty room user=%s", ctx.userId);
  return rpcCreateRoom(
    ctx,
    logger,
    nk,
    JSON.stringify({ name: "빠른 전선", isPublic: true })
  );
}
