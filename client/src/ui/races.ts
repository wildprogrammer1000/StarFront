import { catalogEntityName } from "../game/roster";
import type { RaceId } from "../protocol";

export interface RaceProfile {
  id: RaceId;
  name: string;
  fantasy: string;
  hq: string;
  worker: string;
  building: string;
  buildingType: string;
  unit: string;
  unitType: string;
  unitCost: { energy: number; minerals: number };
  pitch: string;
}

export const RACE_ORDER: RaceId[] = ["human", "monster", "alien"];

/** 현재 서버 배치 비용. 종족별 건물 비용은 시뮬이 나뉘면 이 값만 교체한다. */
export const BUILD_COST = { energy: 4, minerals: 40 } as const;
export const ENERGY_CAP = 10;
/** HUD 인구 표시용 상한 (서버 인구 제한은 아직 없음) */
export const SUPPLY_CAP = 50;

/**
 * 표시 명칭 — SC 한국어 로컬 톤(짧은 직역·병과/생물/광자 어휘).
 * typeId는 유지하고 UI 라벨만 교체한다.
 */
export const RACES: Record<RaceId, RaceProfile> = {
  human: {
    id: "human",
    name: "테론",
    fantasy: "균형 · 방호",
    hq: "사령부",
    worker: "건설로봇",
    building: "병영",
    buildingType: "human_barracks",
    unit: "해병",
    unitType: "human_rifleman",
    unitCost: { energy: 3, minerals: 50 },
    pitch: "중거리 사격으로 전열을 유지한다.",
  },
  monster: {
    id: "monster",
    name: "제르그",
    fantasy: "물량 · 속도",
    hq: "부화장",
    worker: "일벌레",
    building: "번식지",
    buildingType: "monster_hatchery",
    unit: "저글링",
    unitType: "monster_blade",
    unitCost: { energy: 2, minerals: 25 },
    pitch: "빠른 근접으로 수를 늘린다.",
  },
  alien: {
    id: "alien",
    name: "프로티스",
    fantasy: "단단함 · 강타",
    hq: "연결체",
    worker: "탐사정",
    building: "관문",
    buildingType: "alien_gate",
    unit: "광전사",
    unitType: "alien_guardian",
    unitCost: { energy: 5, minerals: 100 },
    pitch: "높은 내구로 전선을 버틴다.",
  },
};

export function raceOf(id: RaceId | undefined): RaceProfile {
  return RACES[id ?? "human"];
}

const CATALOG_DESC: Record<string, string> = {
  human_worker: "자원을 캐고 건물을 짓는 일꾼이다.",
  human_rifleman: "소총으로 중거리를 사격하는 보병이다.",
  human_firebat: "가까운 적에게 화염을 방사한다.",
  human_medic: "아군의 부상을 치료한다.",
  human_hq: "건설로봇을 생산하는 본진이다.",
  human_barracks: "보병 유닛을 훈련한다.",
  human_depot: "인구 상한을 늘린다.",
  human_refinery: "에테르 분출구에서 가스를 정제한다.",
  human_academy: "화염방사병과 의무관 훈련을 연다.",
  monster_worker: "자원을 캐고 건물을 변태시키는 일꾼이다.",
  monster_blade: "빠른 근접 유닛이다. 한 알에서 둘이 태어난다.",
  monster_hydra: "가시로 중거리를 공격한다.",
  monster_sac: "인구 상한을 늘리는 공중 유닛이다.",
  monster_hatch: "유충을 낳고 유닛이 부화하는 본진이다.",
  monster_hatchery: "저글링 변태를 연다.",
  monster_hydra_den: "히드라리스크 변태를 연다.",
  monster_extractor: "에테르 분출구에서 가스를 추출한다.",
  alien_worker: "자원을 캐고 건물을 워프하는 일꾼이다.",
  alien_guardian: "검으로 근접 전투를 하는 전사다.",
  alien_dragoon: "위상포로 중거리를 사격한다.",
  alien_hq: "탐사정을 소환하는 본진이다.",
  alien_gate: "광전사와 용기병을 소환한다.",
  alien_cyber: "용기병 소환을 연다.",
  alien_pylon: "인구 상한을 늘리고 건물에 동력을 공급한다.",
  alien_assimilator: "에테르 분출구에서 가스를 융합한다.",
};

export function catalogDescription(typeId: string): string {
  return CATALOG_DESC[typeId] ?? "";
}

export function entityName(typeId: string, kind: string): string {
  if (kind === "mineral") return "미네랄";
  if (kind === "gas" || typeId === "ether_vent") return "에테르 분출구";
  const named = catalogEntityName(typeId);
  if (named) return named;
  if (kind === "larva" || typeId === "monster_larva") return "유충";
  if (kind === "egg" || typeId === "monster_egg") return "알";
  const race = typeId.startsWith("monster")
    ? RACES.monster
    : typeId.startsWith("alien")
      ? RACES.alien
      : RACES.human;
  if (kind === "hq") return race.hq;
  if (kind === "worker") return race.worker;
  if (kind === "building") return race.building;
  return race.unit;
}
