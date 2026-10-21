import type { EntitySnap } from "../protocol";

/** 선택 HUD에 노출하는 유닛 커맨드 */
export type UnitCmd = "move" | "attack" | "harvest" | "build";

/**
 * typeId별 커맨드 오버라이드.
 * 새 유닛은 여기만 추가하면 되고, 없으면 kind 기본값을 쓴다.
 */
const BY_TYPE: Record<string, readonly UnitCmd[]> = {
  // 대군주: 보급 공중 — 이동만
  monster_sac: ["move"],
  human_worker: ["move", "attack", "harvest", "build"],
  monster_worker: ["move", "attack", "harvest", "build"],
  alien_worker: ["move", "attack", "harvest", "build"],
  human_rifleman: ["move", "attack"],
  human_firebat: ["move", "attack"],
  human_medic: ["move"],
  monster_blade: ["move", "attack"],
  monster_hydra: ["move", "attack"],
  alien_guardian: ["move", "attack"],
  alien_dragoon: ["move", "attack"],
};

const BY_KIND: Partial<Record<EntitySnap["kind"], readonly UnitCmd[]>> = {
  worker: ["move", "attack", "harvest", "build"],
  unit: ["move", "attack"],
};

export function unitCommands(
  typeId: string,
  kind: EntitySnap["kind"]
): readonly UnitCmd[] {
  return BY_TYPE[typeId] ?? BY_KIND[kind] ?? [];
}

export function canUnitCommand(
  typeId: string,
  kind: EntitySnap["kind"],
  cmd: UnitCmd
): boolean {
  return unitCommands(typeId, kind).includes(cmd);
}

/** 선택 중 해당 커맨드를 쓸 수 있는 유닛이 하나라도 있으면 true */
export function selectionHasCommand(
  units: readonly EntitySnap[],
  cmd: UnitCmd
): boolean {
  return units.some((u) => canUnitCommand(u.typeId, u.kind, cmd));
}

/** 해당 커맨드를 가진 유닛 id만 남긴다 */
export function idsWithCommand(
  units: readonly EntitySnap[],
  cmd: UnitCmd
): string[] {
  return units
    .filter((u) => canUnitCommand(u.typeId, u.kind, cmd))
    .map((u) => u.id);
}
