import { HARVEST, VESPENE } from "@shared/economy";

export const TICK_HZ = 10;
export const TICK_DT = 1 / TICK_HZ;
/** 방장 시작 후 전투 진입 전 카운트다운(초) */
export const COUNTDOWN_SEC = 5;

export const MAP = {
  width: 28,
  /** 양 본진 거리 확보 — 월드 깊이 28 (halfDepth 14) */
  depth: 112,
  cellSize: 0.25,
} as const;

/** World XZ extents (centered on origin). */
export const WORLD = {
  halfWidth: (MAP.width * MAP.cellSize) / 2,
  halfDepth: (MAP.depth * MAP.cellSize) / 2,
  groundY: 0,
} as const;

/**
 * 양 기지 사이 중립 교전 구역 (|z| < halfDepth).
 * 모든 플레이어 건물 건설 불가.
 */
export const NEUTRAL = {
  halfDepth: 2,
} as const;

export const ENERGY = {
  start: 0,
  max: 10,
  /** 기본 자동 충전 없음. 자원은 채취·환불 등으로만 증가. */
  perSecond: 0,
} as const;

/** 채취·시작 미네랄 — shared/economy.ts */
export const MINERAL = {
  start: HARVEST.start,
  nodeAmount: HARVEST.nodeAmount,
  carry: HARVEST.carry,
  harvestSec: HARVEST.harvestSec,
  startNodes: HARVEST.startNodes,
} as const;

/** 일꾼 이동 속도. 해병 1.9 × 스타1 일꾼 4.92 / 해병 4. */
export const WORKER_SPEED = 1.9 * (4.92 / 4);

/**
 * 유닛 소프트 충돌 (GDD 6.3).
 * 아군 이동체끼리 약한 밀어내기. 완전 블로킹 없음.
 * 채취 중 일꾼과 건설 명령 중인 인간 일꾼은 이 충돌에서 제외.
 */
export const UNIT_COLLISION = {
  workerR: 0.18,
  unitR: 0.22,
  /** 겹침 해소 비율 (쌍당 절반씩) */
  stiffness: 0.55,
  /** 한 틱·한 쌍에서 한쪽이 밀리는 최대 거리 */
  maxPush: 0.1,
} as const;

/** 외계인 수정주 파워 — 중심 칸 기준 가로×세로(칸) */
export const PYLON_POWER = {
  w: 10,
  d: 6,
} as const;
/** 미네랄·사령부 접근 정지 거리 */
export const WORKER_STOP = {
  mineral: 0.55,
  hq: 1.05,
} as const;
/** 종족별 시작 일꾼 수 */
export const START_WORKERS = 2;

/** 시작 에테르 분출구 — 추출 건물 지을 자리 */
export const GAS = {
  /** 게이지 표시용 더미 HP (고갈 없음, MVP) */
  nodeAmount: VESPENE.nodeAmount,
  startNodes: VESPENE.startNodes,
} as const;

/** 칸 단위 점유. 미네랄·에테르는 동일 3×3(플레이어 시점 좌/우 하단).
 *  HQ는 기존 6×6 유지. */
export const FOOTPRINT = {
  hq: { w: 6, d: 6 },
  mineral: { w: 3, d: 3 },
  gas: { w: 3, d: 3 },
} as const;

export const HQ = {
  maxHp: 3000,
  /** 뒷줄에 붙인 HQ footprint 중심. bottom −Z, top +Z */
  zOffset: WORLD.halfDepth - (FOOTPRINT.hq.d * MAP.cellSize) / 2,
} as const;
