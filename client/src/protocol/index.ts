/** Keep in sync with StarFront-Server/src/protocol. */
export const PROTOCOL_VERSION = 1;

export const OpCode = {
  INPUT: 1,
  SNAPSHOT: 2,
  MATCH_END: 3,
} as const;

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
    | "egg"
    | "bolt";
  side: Side;
  typeId: string;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  rallyX?: number;
  rallyZ?: number;
  constructing?: boolean;
  buildLeft?: number;
  buildSec?: number;
  larva?: number;
  /** 유충이 속한 부화장 */
  homeId?: string;
  queue?: string[];
  prodLeft?: number;
  prodSec?: number;
  /** 알 변태 대상 유닛 typeId */
  morphType?: string;
  /** 알 변태 남은 시간(초) */
  morphLeft?: number;
  /** 알 변태 총 시간(초) */
  morphSec?: number;
  /** 같이 부화한 알(첫 유닛) id. 저글링 두 번째만 가진다. */
  hatchOf?: string;
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
  /** 투사체를 쏜 유닛. 발사 순간 공격 자세에 쓴다. */
  attackerId?: string;
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
  /** 이번 틱에 들어간 타격. 표식 크기는 때린 유닛을 따른다. */
  hits?: HitSnap[];
}

/** 한 틱 동안의 피격. 다음 스냅샷에는 남지 않는다. */
export interface HitSnap {
  x: number;
  z: number;
  /** 때린 유닛. 공격 자세를 그 유닛에만 잠깐 켠다. */
  attackerId?: string;
  /** 때린 유닛 typeId */
  attackerTypeId: string;
  /** 이번 타격 피해 */
  damage: number;
  /** 맞은 진영. 아군 피격 숫자 색을 가른다. */
  side: Side;
  /** 1이면 유닛 높이. 없으면 바닥(건물·자원). */
  lift?: number;
}
