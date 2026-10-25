import type { Client, Session } from "@heroiclabs/nakama-js";
import type {
  CreateRoomResponse,
  JoinRoomResponse,
  ListRoomsResponse,
  RoomRecord,
} from "../protocol/rooms";
import { isAuthError, recoverConnection } from "./nakamaClient";

async function rpcOnce<T>(
  client: Client,
  session: Session,
  id: string,
  payload: object
): Promise<T> {
  const result = await client.rpc(session, id, payload);
  const raw = result.payload as unknown;
  if (raw == null || raw === "") {
    return {} as T;
  }
  if (typeof raw === "string") {
    return JSON.parse(raw) as T;
  }
  return raw as T;
}

async function rpcJson<T>(
  client: Client,
  session: Session,
  id: string,
  payload: object = {}
): Promise<T> {
  try {
    return await rpcOnce<T>(client, session, id, payload);
  } catch (err) {
    if (!isAuthError(err)) throw err;
    // Nakama 재시작·만료 refresh 등으로 저장된 세션이 무효일 때 재로그인 후 1회 재시도
    const recovered = await recoverConnection(client);
    return rpcOnce<T>(client, recovered.session, id, payload);
  }
}

export async function updateNickname(
  client: Client,
  session: Session,
  nickname: string
): Promise<{ ok: boolean; nickname?: string; error?: string }> {
  return rpcJson(client, session, "update_nickname", { nickname });
}

export async function createRoom(
  client: Client,
  session: Session,
  name: string,
  isPublic: boolean
): Promise<RoomRecord> {
  const res = await rpcJson<CreateRoomResponse>(client, session, "create_room", {
    name,
    isPublic,
  });
  return res.room;
}

export async function listRooms(
  client: Client,
  session: Session
): Promise<RoomRecord[]> {
  const res = await rpcJson<ListRoomsResponse>(client, session, "list_rooms", {});
  return res.rooms ?? [];
}

export async function joinRoomByCode(
  client: Client,
  session: Session,
  inviteCode: string
): Promise<RoomRecord> {
  const res = await rpcJson<JoinRoomResponse>(
    client,
    session,
    "join_room_by_code",
    { inviteCode }
  );
  return res.room;
}

/** 자리 있는 공개 대기실 입장, 없으면 빈 방 생성 */
export async function quickJoin(
  client: Client,
  session: Session
): Promise<RoomRecord> {
  const res = await rpcJson<JoinRoomResponse | CreateRoomResponse>(
    client,
    session,
    "quick_join",
    {}
  );
  return res.room;
}
