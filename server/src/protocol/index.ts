/** Client/server contract. protocolVersion must match on both sides. */
export const PROTOCOL_VERSION = 1;

export type RaceId = "human" | "monster" | "alien";
export type Side = "bottom" | "top";

export type PlayerInput =
  | { type: "set_race"; race: RaceId }
  | { type: "host_start" }
  | {
      type: "place_building";
      buildingType: string;
      x: number;
      z: number;
      workerId: string;
    }
  | {
      type: "enqueue_unit";
      buildingId: string;
      unitType: string;
      /** 지정 시 해당 유충만 변태. 없으면 부화장 생산으로 모든 유충 */
      larvaIds?: string[];
    }
  | { type: "cancel_queue"; buildingId: string; queueIndex: number }
  | { type: "cancel_morph"; eggId: string }
  | { type: "set_rally"; buildingId: string; x: number; z: number }
  | { type: "clear_rally"; buildingId: string }
  | { type: "order_harvest"; workerId: string; mineralId: string }
  | { type: "order_move"; unitId: string; x: number; z: number }
  | { type: "order_attack"; unitId: string; targetId: string }
  | { type: "order_attack_move"; unitId: string; x: number; z: number };

export interface Vec2 {
  x: number;
  z: number;
}

export interface EntitySnap {
  id: string;
  kind:
    | "hq"
    | "building"
    | "worker"
    | "unit"
    | "mineral"
    | "gas"
    | "larva"
    | "egg";
  side: Side;
  typeId: string;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  rallyX?: number;
  rallyZ?: number;
  /** 건설 중. 완성 전에는 인구·해금에 포함되지 않는다. */
  constructing?: boolean;
  /** 건설 남은 시간(초) */
  buildLeft?: number;
  /** 건설 총 시간(초) */
  buildSec?: number;
  /** 괴물 부화장의 유충 수 */
  larva?: number;
  /** 유충이 속한 부화장 */
  homeId?: string;
  /** 생산 대기열의 유닛 typeId (최대 5) */
  queue?: string[];
  /** 현재 생산(대기열 맨 앞) 남은 시간(초) */
  prodLeft?: number;
  /** 현재 생산 총 시간(초) */
  prodSec?: number;
  /** 알 변태 대상 유닛 typeId */
  morphType?: string;
  /** 알 변태 남은 시간(초) */
  morphLeft?: number;
  /** 알 변태 총 시간(초) */
  morphSec?: number;
  /** 일꾼이 운반 중인 자원 양 */
  carry?: number;
  /** 에테르 건물 안에서 채취 중. 맵에 그리지 않는다. */
  inside?: boolean;
  /** 수행 중인 명령. 없으면 대기 */
  order?: "move" | "attack" | "attack_move";
  /** 이동·공격이동 목적지 (도착 시 제거) */
  orderX?: number;
  orderZ?: number;
  /** 공격 대상 월드 좌표. 있으면 그 방향을 본다. */
  aimX?: number;
  aimZ?: number;
  /** 자원 채취 중 */
  harvesting?: boolean;
  /** 건설 이동·건설 중 */
  building?: boolean;
}

export interface PlayerSnap {
  userId: string;
  sessionId: string;
  side: Side;
  race: RaceId;
  energy: number;
  minerals: number;
  supply?: number;
  supplyMax?: number;
  /** 계정 표시 이름 */
  displayName?: string;
}

export type MatchStatus = "waiting" | "countdown" | "playing" | "ended";

export interface MatchSnapshot {
  protocolVersion: number;
  tick: number;
  status: MatchStatus;
  countdown?: number;
  hostUserId?: string;
  roomName?: string;
  inviteCode?: string;
  winnerSide?: Side | "draw";
  /** 전투 시작 후 경과 초. 종료 후에도 마지막 값으로 남는다. */
  playSec?: number;
  players: PlayerSnap[];
  entities: EntitySnap[];
  /** 괴물 크립. 월드 칸 비트의 16진 문자열 */
  creep?: string;
}
