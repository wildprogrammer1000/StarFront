/**
 * StarFront 경제 수치 (클라·서버 공용).
 *
 * 미네랄·가스(costE) 비율은 스타크래프트 브루드워를 따른다.
 * 절댓값은 MINERAL_UNIT 으로만 스케일 (기본 50 = SC 마린/일꾼).
 * costE = SC 베스핀(게임 내 에테르) — 배럭·서플라이 등 초반 건물은 0.
 */

/** SC 마린·일꾼 미네랄 = 1.0 기준 단위 */
export const MINERAL_UNIT = 50;

/**
 * SC 브루드워 미네랄 비용 ÷ 50.
 * 예: 배럭 150 → 3.0, 배양못 200 → 4.0, 칼날충(50/2) → 0.5, 질럿 100 → 2.0
 */
export const SC_MINERAL_RATIO = {
  worker: 1,
  marine: 1,
  /** SC Firebat 50 */
  firebat: 1,
  /** SC Medic 50 */
  medic: 1,
  zergling: 0.5,
  /** SC Hydralisk 75 */
  hydralisk: 1.5,
  zealot: 2,
  /** SC Dragoon 125 */
  dragoon: 2.5,
  overlord: 2,
  barracks: 3,
  supply_depot: 2,
  /** SC Academy 150 */
  academy: 3,
  /** SC Spawning Pool 200 — 괴물 배양못(monster_hatchery) */
  spawning_pool: 4,
  /** SC Hatchery 300 — 추가 산란소(monster_hatch) */
  hatchery: 6,
  /** SC Command Center 400 — 추가 사령부(human_hq) */
  command_center: 8,
  /** SC Nexus 400 — 추가 결속소(alien_hq) */
  nexus: 8,
  /** SC Hydralisk Den 100 */
  hydralisk_den: 2,
  gateway: 3,
  /** SC Cybernetics Core 200 */
  cybernetics_core: 4,
  pylon: 2,
  /** SC Refinery 100 */
  refinery: 2,
  /** SC Extractor 50 */
  extractor: 1,
  /** SC Assimilator 100 */
  assimilator: 2,
} as const;

/**
 * SC 베스핀 가스 비용 ÷ MINERAL_UNIT.
 */
export const SC_GAS_RATIO = {
  worker: 0,
  marine: 0,
  firebat: 0.5,
  medic: 0.5,
  zergling: 0,
  hydralisk: 0.5,
  zealot: 0,
  dragoon: 1,
  overlord: 0,
  barracks: 0,
  supply_depot: 0,
  academy: 0,
  spawning_pool: 0,
  hatchery: 0,
  command_center: 0,
  nexus: 0,
  hydralisk_den: 1,
  gateway: 0,
  cybernetics_core: 0,
  pylon: 0,
  refinery: 0,
  extractor: 0,
  assimilator: 0,
} as const;

function mineralOf(ratio: number): number {
  return Math.round(MINERAL_UNIT * ratio);
}

function gasOf(ratio: number): number {
  return Math.round(MINERAL_UNIT * ratio);
}

export type ResourceCost = {
  /** SC 베스핀 대응 (에테르) */
  costE: number;
  /** SC 미네랄 */
  costM: number;
};

/** 채취·시작 자원 (SC 비율 유지, 노드 총량만 플레이테스트용 확장) */
export const HARVEST = {
  /** SC 시작 미네랄 */
  start: mineralOf(1),
  /** SC SCV 1회 운반량 */
  carry: 8,
  /** 노드에서 캐는 시간(초). SC와 완전 동일하진 않음 */
  harvestSec: 2,
  /** 진영당 시작 미네랄 패치 수 */
  startNodes: 2,
  /**
   * 패치 총량. SC 노란 패치 ≈1500 비율이지만,
   * MVP 템포를 위해 크게 둔다. 줄이려면 여기만 수정.
   */
  nodeAmount: 100_000,
} as const;

/** 에테르(가스 대응) 더미 게이지 */
export const VESPENE = {
  nodeAmount: 100_000,
  /** 진영당 시작 에테르 분출구 수 (미네랄과 동일하게 두 덩어리) */
  startNodes: 2,
} as const;

/**
 * 건물 비용.
 * costM = SC 미네랄 비율, costE = SC 가스 비율 (초반 건물 전부 0).
 */
export const BUILDING_COST: Record<string, ResourceCost> = {
  human_barracks: {
    costM: mineralOf(SC_MINERAL_RATIO.barracks),
    costE: gasOf(SC_GAS_RATIO.barracks),
  },
  human_depot: {
    costM: mineralOf(SC_MINERAL_RATIO.supply_depot),
    costE: gasOf(SC_GAS_RATIO.supply_depot),
  },
  monster_hatchery: {
    costM: mineralOf(SC_MINERAL_RATIO.spawning_pool),
    costE: gasOf(SC_GAS_RATIO.spawning_pool),
  },
  monster_hatch: {
    costM: mineralOf(SC_MINERAL_RATIO.hatchery),
    costE: gasOf(SC_GAS_RATIO.hatchery),
  },
  human_hq: {
    costM: mineralOf(SC_MINERAL_RATIO.command_center),
    costE: gasOf(SC_GAS_RATIO.command_center),
  },
  alien_hq: {
    costM: mineralOf(SC_MINERAL_RATIO.nexus),
    costE: gasOf(SC_GAS_RATIO.nexus),
  },
  alien_gate: {
    costM: mineralOf(SC_MINERAL_RATIO.gateway),
    costE: gasOf(SC_GAS_RATIO.gateway),
  },
  alien_pylon: {
    costM: mineralOf(SC_MINERAL_RATIO.pylon),
    costE: gasOf(SC_GAS_RATIO.pylon),
  },
  human_refinery: {
    costM: mineralOf(SC_MINERAL_RATIO.refinery),
    costE: gasOf(SC_GAS_RATIO.refinery),
  },
  monster_extractor: {
    costM: mineralOf(SC_MINERAL_RATIO.extractor),
    costE: gasOf(SC_GAS_RATIO.extractor),
  },
  alien_assimilator: {
    costM: mineralOf(SC_MINERAL_RATIO.assimilator),
    costE: gasOf(SC_GAS_RATIO.assimilator),
  },
  human_academy: {
    costM: mineralOf(SC_MINERAL_RATIO.academy),
    costE: gasOf(SC_GAS_RATIO.academy),
  },
  monster_hydra_den: {
    costM: mineralOf(SC_MINERAL_RATIO.hydralisk_den),
    costE: gasOf(SC_GAS_RATIO.hydralisk_den),
  },
  alien_cyber: {
    costM: mineralOf(SC_MINERAL_RATIO.cybernetics_core),
    costE: gasOf(SC_GAS_RATIO.cybernetics_core),
  },
};

/**
 * 유닛 비용.
 * costM = SC 미네랄, costE = SC 가스.
 */
export const UNIT_COST: Record<
  string,
  ResourceCost & { supply: number }
> = {
  human_worker: {
    costM: mineralOf(SC_MINERAL_RATIO.worker),
    costE: gasOf(SC_GAS_RATIO.worker),
    supply: 1,
  },
  human_rifleman: {
    costM: mineralOf(SC_MINERAL_RATIO.marine),
    costE: gasOf(SC_GAS_RATIO.marine),
    supply: 1,
  },
  human_firebat: {
    costM: mineralOf(SC_MINERAL_RATIO.firebat),
    costE: gasOf(SC_GAS_RATIO.firebat),
    supply: 1,
  },
  human_medic: {
    costM: mineralOf(SC_MINERAL_RATIO.medic),
    costE: gasOf(SC_GAS_RATIO.medic),
    supply: 1,
  },
  monster_worker: {
    costM: mineralOf(SC_MINERAL_RATIO.worker),
    costE: gasOf(SC_GAS_RATIO.worker),
    supply: 1,
  },
  monster_blade: {
    costM: mineralOf(SC_MINERAL_RATIO.zergling),
    costE: gasOf(SC_GAS_RATIO.zergling),
    /** 알 1개(칼날충 2기)당 인구 1 */
    supply: 1,
  },
  monster_hydra: {
    costM: mineralOf(SC_MINERAL_RATIO.hydralisk),
    costE: gasOf(SC_GAS_RATIO.hydralisk),
    supply: 1,
  },
  monster_sac: {
    costM: mineralOf(SC_MINERAL_RATIO.overlord),
    costE: gasOf(SC_GAS_RATIO.overlord),
    supply: 0,
  },
  alien_worker: {
    costM: mineralOf(SC_MINERAL_RATIO.worker),
    costE: gasOf(SC_GAS_RATIO.worker),
    supply: 1,
  },
  alien_guardian: {
    costM: mineralOf(SC_MINERAL_RATIO.zealot),
    costE: gasOf(SC_GAS_RATIO.zealot),
    supply: 1,
  },
  alien_dragoon: {
    costM: mineralOf(SC_MINERAL_RATIO.dragoon),
    costE: gasOf(SC_GAS_RATIO.dragoon),
    supply: 2,
  },
};

export function buildingCost(typeId: string): ResourceCost | null {
  return BUILDING_COST[typeId] ?? null;
}

export function unitCost(typeId: string): (ResourceCost & { supply: number }) | null {
  return UNIT_COST[typeId] ?? null;
}
