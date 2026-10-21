import {
  ROOM_COLLECTION,
  ROOM_OWNER_USER_ID,
  type RoomRecord,
  type RoomStatus,
} from "./types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 대기 중·인원 0인 방이 이 시간 지나면 삭제 */
export const STALE_WAITING_MS = 30 * 60 * 1000;
/** 생성 직후 이 시간 안에는 match_gone으로 삭제하지 않음 (조인 레이스 방지) */
export const MATCH_GONE_GRACE_MS = 15 * 1000;

export function generateInviteCode(nk: nkruntime.Nakama): string {
  for (let attempt = 0; attempt < 16; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
      code += CODE_ALPHABET.charAt(idx);
    }
    const existing = readRoomByCode(nk, code);
    if (!existing) return code;
  }
  return ("R" + Date.now().toString(36)).toUpperCase().slice(0, 6);
}

export function writeRoom(nk: nkruntime.Nakama, room: RoomRecord): void {
  nk.storageWrite([
    {
      collection: ROOM_COLLECTION,
      key: room.inviteCode,
      userId: ROOM_OWNER_USER_ID,
      value: room,
      permissionRead: 2,
      permissionWrite: 0,
    },
  ]);
}

export function readRoomByCode(
  nk: nkruntime.Nakama,
  inviteCode: string
): RoomRecord | null {
  const code = inviteCode.trim().toUpperCase();
  if (!code) return null;
  const objects = nk.storageRead([
    {
      collection: ROOM_COLLECTION,
      key: code,
      userId: ROOM_OWNER_USER_ID,
    },
  ]);
  if (!objects || objects.length === 0) return null;
  return objects[0].value as RoomRecord;
}

export function listAllRooms(nk: nkruntime.Nakama): RoomRecord[] {
  const rooms: RoomRecord[] = [];
  let cursor: string | undefined = undefined;
  for (let page = 0; page < 20; page++) {
    const listed = cursor
      ? nk.storageList(ROOM_OWNER_USER_ID, ROOM_COLLECTION, 100, cursor)
      : nk.storageList(ROOM_OWNER_USER_ID, ROOM_COLLECTION, 100);
    const objects = listed.objects || [];
    for (let i = 0; i < objects.length; i++) {
      const room = objects[i].value as RoomRecord;
      if (room && room.inviteCode) {
        rooms.push(room);
      }
    }
    if (!listed.cursor || objects.length === 0) break;
    cursor = listed.cursor;
  }
  return rooms;
}

export function listPublicWaitingRooms(nk: nkruntime.Nakama): RoomRecord[] {
  const rooms: RoomRecord[] = [];
  const all = listAllRooms(nk);
  for (let i = 0; i < all.length; i++) {
    const room = all[i];
    if (
      room.isPublic &&
      room.status === "waiting" &&
      room.playerCount < room.maxPlayers
    ) {
      rooms.push(room);
    }
  }
  rooms.sort(function (a, b) {
    // 1인 대기 방을 먼저, 그다음 빈 방, 최신순
    if (a.playerCount !== b.playerCount) {
      return b.playerCount - a.playerCount;
    }
    return b.createdAt - a.createdAt;
  });
  return rooms;
}

export function updateRoomStatus(
  nk: nkruntime.Nakama,
  inviteCode: string,
  status: RoomStatus,
  playerCount?: number
): void {
  const room = readRoomByCode(nk, inviteCode);
  if (!room) return;
  room.status = status;
  if (typeof playerCount === "number") {
    room.playerCount = playerCount;
  }
  writeRoom(nk, room);
}

export function deleteRoom(nk: nkruntime.Nakama, inviteCode: string): void {
  nk.storageDelete([
    {
      collection: ROOM_COLLECTION,
      key: inviteCode.toUpperCase(),
      userId: ROOM_OWNER_USER_ID,
    },
  ]);
}

export function matchAliveSafe(nk: nkruntime.Nakama, matchId: string): boolean {
  if (!matchId) return false;
  try {
    const m = nk.matchGet(matchId);
    return !!m;
  } catch (_e) {
    return false;
  }
}

/**
 * 필요 없는 방 스토리지 자동 삭제.
 * - closed
 * - 매치가 이미 없음
 * - waiting + 인원 0 + 생성 후 STALE_WAITING_MS 경과
 */
export function cleanupStaleRooms(
  nk: nkruntime.Nakama,
  logger?: nkruntime.Logger
): number {
  const now = Date.now();
  const all = listAllRooms(nk);
  let deleted = 0;

  for (let i = 0; i < all.length; i++) {
    const room = all[i];
    let reason = "";

    const age = now - (room.createdAt || 0);

    if (room.status === "closed") {
      reason = "closed";
    } else if (!matchAliveSafe(nk, room.matchId)) {
      // 방금 만든 방은 조인 전·직후 matchGet 레이스가 있을 수 있어 유예
      if (age > MATCH_GONE_GRACE_MS) {
        reason = "match_gone";
      }
    } else if (
      room.status === "waiting" &&
      room.playerCount <= 0 &&
      age > STALE_WAITING_MS
    ) {
      reason = "stale_empty_waiting";
    }

    if (reason) {
      deleteRoom(nk, room.inviteCode);
      deleted += 1;
      if (logger) {
        logger.info(
          "stale room deleted code=%s reason=%s",
          room.inviteCode,
          reason
        );
      }
    }
  }

  return deleted;
}
