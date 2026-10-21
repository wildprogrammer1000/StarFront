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

export interface CreateRoomResponse {
  room: RoomRecord;
}

export interface ListRoomsResponse {
  rooms: RoomRecord[];
}

export interface JoinRoomResponse {
  room: RoomRecord;
}
