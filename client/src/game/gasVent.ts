import type { EntitySnap } from "../protocol";
import { buildingDef } from "./roster";

/** 분출구 중심과 에테르 건물 중심이 같으면 건물이 분출구를 덮는다. */
const COVER_R2 = 0.2 * 0.2;

export function isGasBuilding(e: EntitySnap): boolean {
  if (e.kind !== "building") return false;
  const def = buildingDef(e.typeId);
  return !!def && def.role === "gas";
}

export function gasBuildingOnVent(
  entities: EntitySnap[],
  vent: EntitySnap
): EntitySnap | null {
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (!isGasBuilding(e)) continue;
    const dx = e.x - vent.x;
    const dz = e.z - vent.z;
    if (dx * dx + dz * dz <= COVER_R2) return e;
  }
  return null;
}

export function ventCovered(entities: EntitySnap[], vent: EntitySnap): boolean {
  return gasBuildingOnVent(entities, vent) != null;
}

/** 에테르 건물이 덮고 있는 분출구의 남은 매장량. */
export function ventAmountForBuilding(
  entities: EntitySnap[],
  building: EntitySnap
): number | null {
  if (!isGasBuilding(building)) return null;
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.kind !== "gas") continue;
    const dx = e.x - building.x;
    const dz = e.z - building.z;
    if (dx * dx + dz * dz <= COVER_R2) return e.hp;
  }
  return null;
}
