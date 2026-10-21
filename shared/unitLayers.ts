/**
 * 유닛 고도 레이어 (클라·서버 공용).
 * 공중은 지상 유닛·건물과 충돌하지 않는다.
 * 새 공중 유닛은 AIR_TYPES 에 typeId: true 만 추가하면 된다.
 * Goja 호환: Set / Map 사용 금지.
 */

export type UnitLayer = "ground" | "air";

/** 공중 유닛 typeId → true */
export const AIR_TYPES: { [typeId: string]: true } = {
  monster_sac: true,
};

export function unitLayer(typeId: string): UnitLayer {
  return AIR_TYPES[typeId] ? "air" : "ground";
}

export function isAirUnit(typeId: string): boolean {
  return !!AIR_TYPES[typeId];
}

/** 같은 레이어끼리만 소프트 충돌 등 물리 상호작용 */
export function layersCollide(typeIdA: string, typeIdB: string): boolean {
  return unitLayer(typeIdA) === unitLayer(typeIdB);
}
