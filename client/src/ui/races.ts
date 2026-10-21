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
    name: "인간",
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
    name: "괴물",
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
    name: "외계인",
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
