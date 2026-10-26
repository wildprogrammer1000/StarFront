import type { RaceId } from "@shared/protocol";
import { BUILDING_COST, UNIT_COST } from "@shared/economy";
import {
  BUILDING_ROWS,
  LARVA_SEC,
  UNIT_ROWS,
  listsPlace,
  scaleScTime,
  unitRow,
  type BuildMethod,
  type BuildRole,
} from "@shared/rosterData";

/** 인구 상한. 맵 규모에 맞춰 50에서 자른다. 보급 건물·부유체는 +8. */
export const SUPPLY_CAP = 50;
export const SUPPLY_BONUS = 8;
export const LARVA_CAP = 3;
export { LARVA_SEC };

export interface BuildingDef {
  typeId: string;
  race: RaceId;
  w: number;
  d: number;
  costE: number;
  costM: number;
  hp: number;
  buildSec: number;
  /** worker=공병이 건설, morph=일벌을 소모, warp=건물 스스로 완성 */
  method: BuildMethod;
  role: BuildRole;
  /** 이 건물이 완성돼 있어야 건설 */
  needs?: string;
}

export interface UnitDef {
  typeId: string;
  race: RaceId;
  costE: number;
  costM: number;
  supply: number;
  /** 적용 생산 시간(초). rosterData scSec × 0.6 */
  time: number;
  /** 괴물 유닛은 유충을 소모한다 */
  larva: boolean;
  /** 생산 목록 키. "hq" | "larva" | 건물 typeId */
  producedAt: string[];
  /** 이 건물이 완성돼 있어야 생산 가능 */
  needs?: string;
}

function costOf(typeId: string): { costE: number; costM: number } {
  const c = BUILDING_COST[typeId];
  if (!c) throw new Error(`missing BUILDING_COST: ${typeId}`);
  return c;
}

function unitCostOf(typeId: string): {
  costE: number;
  costM: number;
  supply: number;
} {
  const c = UNIT_COST[typeId];
  if (!c) throw new Error(`missing UNIT_COST: ${typeId}`);
  return c;
}

function loadBuildings(): BuildingDef[] {
  const out: BuildingDef[] = [];
  for (let i = 0; i < BUILDING_ROWS.length; i++) {
    const row = BUILDING_ROWS[i];
    const cost = costOf(row.typeId);
    const def: BuildingDef = {
      typeId: row.typeId,
      race: row.race,
      w: row.w,
      d: row.d,
      costE: cost.costE,
      costM: cost.costM,
      hp: row.hp,
      buildSec: scaleScTime(row.scSec),
      method: row.method,
      role: row.role,
    };
    if (row.needs) def.needs = row.needs;
    out.push(def);
  }
  return out;
}

function loadUnits(): UnitDef[] {
  const out: UnitDef[] = [];
  for (let i = 0; i < UNIT_ROWS.length; i++) {
    const row = UNIT_ROWS[i];
    const cost = unitCostOf(row.typeId);
    const def: UnitDef = {
      typeId: row.typeId,
      race: row.race,
      costE: cost.costE,
      costM: cost.costM,
      supply: cost.supply,
      time: scaleScTime(row.scSec),
      larva: row.larva,
      producedAt: row.producedAt,
    };
    if (row.needs) def.needs = row.needs;
    out.push(def);
  }
  return out;
}

const BUILDINGS: BuildingDef[] = loadBuildings();
const UNITS: UnitDef[] = loadUnits();

export function buildingDef(typeId: string): BuildingDef | null {
  for (let i = 0; i < BUILDINGS.length; i++) {
    if (BUILDINGS[i].typeId === typeId) return BUILDINGS[i];
  }
  return null;
}

export function unitDef(typeId: string): UnitDef | null {
  for (let i = 0; i < UNITS.length; i++) {
    if (UNITS[i].typeId === typeId) return UNITS[i];
  }
  return null;
}

/** 이 건물·사령부·유충 선택에서 해당 유닛을 뽑을 수 있는지. */
export function unitProducedAt(
  typeId: string,
  place: string
): boolean {
  const row = unitRow(typeId);
  if (!row) return false;
  return listsPlace(row.producedAt, place);
}

export function footprintOf(typeId: string): { w: number; d: number } {
  const def = buildingDef(typeId);
  if (def) return { w: def.w, d: def.d };
  return { w: 3, d: 3 };
}

/** 홀수 발자국의 중심 칸에서 왼쪽·아래 원점. */
export function footprintOrigin(
  cx: number,
  cz: number,
  w: number,
  d: number
): { cx: number; cz: number } {
  return {
    cx: cx - Math.floor((w - 1) / 2),
    cz: cz - Math.floor((d - 1) / 2),
  };
}
