import type { EntitySnap, RaceId, Side } from "../protocol";
import {
  BUILDING_COST,
  UNIT_COST as ECONOMY_UNIT_COST,
  unitCost as economyUnitCost,
} from "@shared/economy";
import {
  BUILDING_ROWS,
  UNIT_ROWS,
  catalogName,
  listsPlace,
  type BuildMethod,
  type BuildRole,
  type UnitRow,
} from "@shared/rosterData";

export const SUPPLY_CAP = 50;
export const SUPPLY_BONUS = 8;
export const LARVA_CAP = 3;

export interface BuildingDef {
  typeId: string;
  race: RaceId;
  name: string;
  w: number;
  d: number;
  costE: number;
  costM: number;
  method: BuildMethod;
  role: BuildRole;
  /** 이 건물이 완성돼 있어야 건설 */
  needs?: string;
}

function buildingCostOf(typeId: string): { costE: number; costM: number } {
  const c = BUILDING_COST[typeId];
  if (!c) throw new Error(`missing BUILDING_COST: ${typeId}`);
  return c;
}

export const BUILDINGS: BuildingDef[] = BUILDING_ROWS.map((row) => {
  const def: BuildingDef = {
    typeId: row.typeId,
    race: row.race,
    name: row.name,
    w: row.w,
    d: row.d,
    ...buildingCostOf(row.typeId),
    method: row.method,
    role: row.role,
  };
  if (row.needs) def.needs = row.needs;
  return def;
});

/** 선택한 사령부·건물·유충에서 뽑을 수 있는 유닛. 순서는 UNIT_ROWS. */
export function unitsAt(race: RaceId, place: string): UnitRow[] {
  return UNIT_ROWS.filter(
    (row) => row.race === race && listsPlace(row.producedAt, place)
  );
}

export function catalogEntityName(typeId: string): string | null {
  return catalogName(typeId);
}

export function buildingsFor(race: RaceId): BuildingDef[] {
  return BUILDINGS.filter((b) => b.race === race);
}

export function buildingDef(typeId: string): BuildingDef | null {
  return BUILDINGS.find((b) => b.typeId === typeId) ?? null;
}

/** shared/economy 와 동일 — UI afford 체크용 */
export const UNIT_COST = ECONOMY_UNIT_COST;

export function unitCost(
  typeId: string
): { costE: number; costM: number; supply: number } | null {
  return economyUnitCost(typeId);
}

export function footprintOf(typeId: string): { w: number; d: number } {
  const def = buildingDef(typeId);
  if (def) return { w: def.w, d: def.d };
  return { w: 3, d: 3 };
}

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

export function supplyCount(
  side: Side,
  race: RaceId,
  entities: EntitySnap[]
): { used: number; max: number } {
  let used = 0;
  let bonus = 0;
  let blades = 0;
  for (const e of entities) {
    if (e.side !== side) continue;
    if (e.kind === "worker") used += 1;
    else if (e.kind === "unit" && e.typeId === "monster_blade") blades += 1;
    else if (e.kind === "unit" && e.typeId !== "monster_sac") used += 1;
    else if (e.kind === "egg" && e.morphType) {
      // 알로 변태하는 순간부터 해당 유닛 인구를 예약한다.
      const c = unitCost(e.morphType);
      if (c) used += c.supply;
    }
    if (e.typeId === "monster_sac") bonus += SUPPLY_BONUS;
    if (
      !e.constructing &&
      (e.typeId === "human_depot" || e.typeId === "alien_pylon")
    ) {
      bonus += SUPPLY_BONUS;
    }
  }
  const base = race === "monster" ? 0 : 10;
  // 칼날충 실개체는 2기 = 인구 1. 알은 unitCost.supply로 이미 잡음.
  used += Math.ceil(blades / 2);
  return { used, max: Math.min(SUPPLY_CAP, base + bonus) };
}

export function hasReadyBuilding(
  entities: EntitySnap[],
  side: Side,
  typeId: string
): boolean {
  return entities.some(
    (e) => e.side === side && e.typeId === typeId && e.kind === "building" && !e.constructing
  );
}
