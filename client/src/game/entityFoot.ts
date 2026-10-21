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
    default:
      if (e.typeId === "monster_blade") return { w: 0.38, d: 0.38 };
      if (e.typeId === "monster_hydra") return { w: 0.55, d: 0.55 };
      if (e.typeId === "alien_dragoon") return { w: 0.72, d: 0.72 };
      return { w: 0.62, d: 0.62 };
  }
}

/**
 * 선택 테두리가 맞출 칸 점유. 스프라이트 여백 없이 그리드 크기 그대로.
 * 유닛·일꾼·유충·알은 1칸.
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
