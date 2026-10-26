import type { EntitySnap } from "../protocol";
import { CELL } from "./grid";
import { footprintOf } from "./roster";

/**
 * 전장에 깔린 스프라이트의 XZ 크기.
 * playcanvasApp 과 드래그 선택이 같은 사각형을 쓰게 한다.
 */
export function groundFoot(e: EntitySnap): { w: number; d: number } {
  switch (e.kind) {
    case "hq":
      return { w: 6 * CELL * 1.05, d: 6 * CELL * 1.05 };
    case "building": {
      const fp = footprintOf(e.typeId);
      return { w: fp.w * CELL * 1.1, d: fp.d * CELL * 1.1 };
    }
    case "mineral":
    case "gas":
      return { w: 3 * CELL * 1.15, d: 3 * CELL * 1.15 };
    case "larva":
      return { w: 0.26, d: 0.26 };
    case "egg":
      return { w: 0.36, d: 0.36 };
    case "worker":
      return { w: 0.55, d: 0.55 };
    case "bolt":
      return { w: 0.5, d: 0.5 };
    default:
      if (e.typeId === "monster_blade") return { w: 0.38, d: 0.38 };
      if (e.typeId === "monster_hydra") return { w: 0.55, d: 0.55 };
      if (e.typeId === "alien_dragoon") return { w: 0.72, d: 0.72 };
      return { w: 0.62, d: 0.62 };
  }
}

/** 피격 표식의 보이는 한 변. 맞은 대상이 아니라 때린 유닛 스프라이트 크기. */
export function attackerSpan(typeId: string): number {
  const kind: EntitySnap["kind"] =
    typeId.indexOf("worker") >= 0 ? "worker" : "unit";
  const foot = groundFoot({
    id: "",
    kind,
    side: "bottom",
    typeId,
    x: 0,
    z: 0,
    hp: 1,
    maxHp: 1,
  });
  return Math.max(foot.w, foot.d);
}

/**
 * 건물·자원 선택 테두리가 맞출 칸 점유.
 * 유닛·일꾼·유충·알은 스프라이트 크기(groundFoot)를 쓴다.
 */
export function gridFoot(e: EntitySnap): { w: number; d: number } {
  switch (e.kind) {
    case "hq":
      return { w: 6 * CELL, d: 6 * CELL };
    case "building": {
      const fp = footprintOf(e.typeId);
      return { w: fp.w * CELL, d: fp.d * CELL };
    }
    case "mineral":
    case "gas":
      return { w: 3 * CELL, d: 3 * CELL };
    default:
      return { w: CELL, d: CELL };
  }
}
