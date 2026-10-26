export const ROOM_COLLECTION = "rooms";
/** Nakama system user — server-owned storage. */
export const ROOM_OWNER_USER_ID = "00000000-0000-0000-0000-000000000000";

export type RoomStatus = "waiting" | "playing" | "closed";

export interface RoomRecord {
  roomId: string;
  matchId: string;
  inviteCode: string;
  name: string;
  isPublic: boolean;
  hostUserId: string;
  status: RoomStatus;
  maxPlayers: number;
  playerCount: number;
  createdAt: number;
}

export interface CreateRoomRequest {
  name?: string;
  isPublic?: boolean;
  /** 사람 대신 서버 봇이 상대가 된다. 공개 목록에는 올리지 않는다. */
  vsBot?: boolean;
}

export interface CreateRoomResponse {
  room: RoomRecord;
}

export interface ListRoomsResponse {
  rooms: RoomRecord[];
}

export interface JoinRoomRequest {
  inviteCode: string;
}

export interface JoinRoomResponse {
  room: RoomRecord;
}
