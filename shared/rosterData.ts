/**
 * 유닛·건물 카탈로그 (클라·서버 공용). 비용은 shared/economy.ts.
 *
 * 시간을 바꿀 때는 scSec(스타 1 Fastest 초)만 고친다.
 * 적용 초 = scSec × TIME_SCALE, 소수 한 자리.
 *
 * 유닛을 추가할 때
 * 1. UNIT_ROWS 에 한 줄 추가 (producedAt: "hq" | "larva" | 건물 typeId)
 * 2. economy.ts UNIT_COST 에 같은 typeId 비용 추가
 * 3. 스프라이트·초상화 경로 추가
 */

export const TIME_SCALE = 0.6;

/** 스타 1 Fastest 초 → 적용 초. 12.6 → 7.6 */
export function scaleScTime(scSec: number): number {
  const tenths = Math.round(scSec * 10);
  return Math.round(tenths * TIME_SCALE) / 10;
}

/** 유충 재생성. 스타 1 라바 12.6초의 60%. */
export const LARVA_SC_SEC = 12.6;
export const LARVA_SEC = scaleScTime(LARVA_SC_SEC);

export type CatalogRace = "human" | "monster" | "alien";
export type BuildMethod = "worker" | "morph" | "warp";
export type BuildRole = "produce" | "supply" | "unlock" | "gas";

export interface UnitRow {
  typeId: string;
  name: string;
  race: CatalogRace;
  /**
   * 이 키를 선택한 동안 생산 목록에 나온다.
   * "hq" 사령부, "larva" 유충 선택, 그 외는 건물 typeId.
   * 서버의 유충 변태는 소속 부화장으로 넘긴 뒤 "hq" 또는 건물 typeId 로 검사한다.
   */
  producedAt: string[];
  /** 스타 1 Fastest 초. 칼날은 저글링 알(2기가 아니라 알 시간). */
  scSec: number;
  larva: boolean;
  /** 이 건물이 완성돼 있어야 생산 */
  needs?: string;
}

export interface BuildingRow {
  typeId: string;
  name: string;
  race: CatalogRace;
  w: number;
  d: number;
  hp: number;
  method: BuildMethod;
  role: BuildRole;
  /** 스타 1 Fastest 초 */
  scSec: number;
  /** 이 건물이 완성돼 있어야 건설 */
  needs?: string;
}

export const UNIT_ROWS: UnitRow[] = [
  {
    typeId: "human_worker",
    name: "건설로봇",
    race: "human",
    producedAt: ["hq"],
    scSec: 12.6,
    larva: false,
  },
  {
    typeId: "human_rifleman",
    name: "해병",
    race: "human",
    producedAt: ["human_barracks"],
    scSec: 15.1,
    larva: false,
  },
  {
    typeId: "human_firebat",
    name: "화염방사병",
    race: "human",
    producedAt: ["human_barracks"],
    scSec: 15.1,
    larva: false,
    needs: "human_academy",
  },
  {
    typeId: "human_medic",
    name: "의무관",
    race: "human",
    producedAt: ["human_barracks"],
    scSec: 18.9,
    larva: false,
    needs: "human_academy",
  },
  {
    typeId: "monster_sac",
    name: "대군주",
    race: "monster",
    producedAt: ["hq", "monster_hatch", "larva"],
    scSec: 25.2,
    larva: true,
  },
  {
    typeId: "monster_blade",
    name: "저글링",
    race: "monster",
    producedAt: ["hq", "monster_hatch", "larva"],
    scSec: 17.6,
    larva: true,
    needs: "monster_hatchery",
  },
  {
    typeId: "monster_hydra",
    name: "히드라리스크",
    race: "monster",
    producedAt: ["hq", "monster_hatch", "larva"],
    scSec: 17.6,
    larva: true,
    needs: "monster_hydra_den",
  },
  {
    typeId: "monster_worker",
    name: "일벌레",
    race: "monster",
    producedAt: ["hq", "monster_hatch", "larva"],
    scSec: 12.6,
    larva: true,
  },
  {
    typeId: "alien_worker",
    name: "탐사정",
    race: "alien",
    producedAt: ["hq"],
    scSec: 12.6,
    larva: false,
  },
  {
    typeId: "alien_guardian",
    name: "광전사",
    race: "alien",
    producedAt: ["alien_gate"],
    scSec: 25.2,
    larva: false,
  },
  {
    typeId: "alien_dragoon",
    name: "용기병",
    race: "alien",
    producedAt: ["alien_gate"],
    scSec: 31.5,
    larva: false,
    needs: "alien_cyber",
  },
];

/** w/d = 스타1 가로(폭) 기준의 정사각(1:1). 예: 병영·관문 4×4, 보급고 3×3, 수정탑 2×2.
 *  사령부·미네랄·에테르는 기존 6×6 / 3×3. */
export const BUILDING_ROWS: BuildingRow[] = [
  {
    typeId: "human_barracks",
    name: "병영",
    race: "human",
    w: 4,
    d: 4,
    hp: 600,
    method: "worker",
    role: "produce",
    scSec: 50.4,
  },
  {
    typeId: "human_depot",
    name: "보급고",
    race: "human",
    w: 3,
    d: 3,
    hp: 400,
    method: "worker",
    role: "supply",
    scSec: 25.2,
  },
  {
    typeId: "human_refinery",
    name: "정제소",
    race: "human",
    w: 3,
    d: 3,
    hp: 600,
    method: "worker",
    role: "gas",
    scSec: 25.2,
  },
  {
    typeId: "human_academy",
    name: "사관학교",
    race: "human",
    w: 3,
    d: 3,
    hp: 600,
    method: "worker",
    role: "unlock",
    scSec: 50.4,
    needs: "human_barracks",
  },
  {
    typeId: "monster_hatch",
    name: "부화장",
    race: "monster",
    // 시작 HQ(monster_hq)와 동일: FOOTPRINT.hq 6×6, HQ.maxHp 3000
    w: 6,
    d: 6,
    hp: 3000,
    method: "morph",
    role: "produce",
    scSec: 75.6,
  },
  {
    typeId: "monster_hatchery",
    name: "번식지",
    race: "monster",
    w: 3,
    d: 3,
    hp: 500,
    method: "morph",
    role: "unlock",
    scSec: 50.4,
  },
  {
    typeId: "monster_hydra_den",
    name: "히드라리스크 굴",
    race: "monster",
    w: 3,
    d: 3,
    hp: 850,
    method: "morph",
    role: "unlock",
    scSec: 25.2,
    needs: "monster_hatchery",
  },
  {
    typeId: "monster_extractor",
    name: "추출장",
    race: "monster",
    w: 3,
    d: 3,
    hp: 500,
    method: "morph",
    role: "gas",
    scSec: 25.2,
  },
  {
    typeId: "alien_gate",
    name: "관문",
    race: "alien",
    w: 4,
    d: 4,
    hp: 700,
    method: "warp",
    role: "produce",
    scSec: 37.8,
  },
  {
    typeId: "alien_cyber",
    name: "사이버네틱스 핵",
    race: "alien",
    w: 3,
    d: 3,
    hp: 500,
    method: "warp",
    role: "unlock",
    scSec: 37.8,
    needs: "alien_gate",
  },
  {
    typeId: "alien_pylon",
    name: "수정탑",
    race: "alien",
    w: 2,
    d: 2,
    hp: 250,
    method: "warp",
    role: "supply",
    scSec: 18.9,
  },
  {
    typeId: "alien_assimilator",
    name: "융합소",
    race: "alien",
    w: 3,
    d: 3,
    hp: 450,
    method: "warp",
    role: "gas",
    scSec: 25.2,
  },
];

export function unitRow(typeId: string): UnitRow | null {
  for (let i = 0; i < UNIT_ROWS.length; i++) {
    if (UNIT_ROWS[i].typeId === typeId) return UNIT_ROWS[i];
  }
  return null;
}

export function buildingRow(typeId: string): BuildingRow | null {
  for (let i = 0; i < BUILDING_ROWS.length; i++) {
    if (BUILDING_ROWS[i].typeId === typeId) return BUILDING_ROWS[i];
  }
  return null;
}

export function catalogName(typeId: string): string | null {
  const unit = unitRow(typeId);
  if (unit) return unit.name;
  const building = buildingRow(typeId);
  return building ? building.name : null;
}

export function listsPlace(places: string[], place: string): boolean {
  for (let i = 0; i < places.length; i++) {
    if (places[i] === place) return true;
  }
  return false;
}
