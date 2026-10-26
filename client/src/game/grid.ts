import type { EntitySnap, Side } from "../protocol";
import { cellInPylonPower, pylonPowerSize } from "@shared/pylonPower";
import { footprintOf, footprintOrigin } from "./roster";

/** 서버 MAP / WORLD 와 동일. 월드 7×20, 칸 0.25. */
export const CELL = 0.25;
export const HALF_W = 3.5;
export const HALF_D = 14;
/** 서버 NEUTRAL.halfDepth 와 동일 — 중앙 건설 불가 구역 */
export const NEUTRAL_HALF_D = 2;
export const GRID_W = Math.round((HALF_W * 2) / CELL);
export const GRID_D = Math.round((HALF_D * 2) / CELL);

export interface Cell {
  cx: number;
  cz: number;
  x: number;
  z: number;
}

export function worldToCell(x: number, z: number): { cx: number; cz: number } {
  return {
    cx: Math.floor((x + HALF_W) / CELL),
    cz: Math.floor((z + HALF_D) / CELL),
  };
}

export function cellCenter(cx: number, cz: number): { x: number; z: number } {
  return {
    x: -HALF_W + (cx + 0.5) * CELL,
    z: -HALF_D + (cz + 0.5) * CELL,
  };
}

export function snapToCell(x: number, z: number): Cell | null {
  const { cx, cz } = worldToCell(x, z);
  if (cx < 0 || cz < 0 || cx >= GRID_W || cz >= GRID_D) return null;
  return { cx, cz, ...cellCenter(cx, cz) };
}

/** 서버 inBuildZone 과 같은 월드 구역 (중앙 중립 제외). */
export function isBuildCell(side: Side, cx: number, cz: number): boolean {
  if (cx < 0 || cz < 0 || cx >= GRID_W || cz >= GRID_D) return false;
  const { z } = cellCenter(cx, cz);
  if (Math.abs(z) < NEUTRAL_HALF_D) return false;
  if (side === "bottom") return z <= -NEUTRAL_HALF_D && z > -HALF_D + 0.5;
  return z >= NEUTRAL_HALF_D && z < HALF_D - 0.5;
}

export function buildCells(side: Side): Cell[] {
  const cells: Cell[] = [];
  for (let cz = 0; cz < GRID_D; cz++) {
    for (let cx = 0; cx < GRID_W; cx++) {
      if (!isBuildCell(side, cx, cz)) continue;
      cells.push({ cx, cz, ...cellCenter(cx, cz) });
    }
  }
  return cells;
}

function blockerHalf(kind: string, typeId: string): { x: number; z: number } {
  if (kind === "hq") return { x: 3 * CELL, z: 3 * CELL };
  if (kind === "mineral") return { x: 1.5 * CELL, z: 1.5 * CELL };
  if (kind === "gas") return { x: 1.5 * CELL, z: 1.5 * CELL };
  if (kind === "building") {
    const fp = footprintOf(typeId);
    return { x: (fp.w * CELL) / 2, z: (fp.d * CELL) / 2 };
  }
  return { x: CELL * 0.44, z: CELL * 0.44 };
}

function overlapsCell(
  ex: number,
  ez: number,
  kind: string,
  typeId: string,
  cx: number,
  cz: number
): boolean {
  const c = cellCenter(cx, cz);
  const half = blockerHalf(kind, typeId);
  const limitX = half.x + CELL / 2 - 1e-4;
  const limitZ = half.z + CELL / 2 - 1e-4;
  return Math.abs(ex - c.x) < limitX && Math.abs(ez - c.z) < limitZ;
}

/** 아군 건설 구역의 가운데 칸. 미리보기의 시작 위치. */
export function zoneCenterCell(side: Side): { cx: number; cz: number } {
  const bottomCz = 11;
  return {
    cx: Math.floor(GRID_W / 2) - 1,
    cz: side === "bottom" ? bottomCz : GRID_D - 1 - bottomCz,
  };
}

export function cellPowered(
  entities: EntitySnap[],
  side: Side,
  cx: number,
  cz: number
): boolean {
  const c = cellCenter(cx, cz);
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.side !== side || e.typeId !== "alien_pylon" || e.hp <= 0) continue;
    if (cellInPylonPower(e.x, e.z, c.x, c.z, CELL)) return true;
  }
  return false;
}

export function footprintPowered(
  entities: EntitySnap[],
  side: Side,
  cx: number,
  cz: number,
  w: number,
  d: number
): boolean {
  const origin = footprintOrigin(cx, cz, w, d);
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      if (!cellPowered(entities, side, origin.cx + dx, origin.cz + dz)) {
        return false;
      }
    }
  }
  return true;
}

export function needsPylonPower(typeId: string): boolean {
  // 융합소는 분출구 위라면 수정주 범위 밖에도 짓는다.
  return (
    typeId.indexOf("alien_") === 0 &&
    typeId !== "alien_pylon" &&
    typeId !== "alien_assimilator"
  );
}

/** 아군 수정주마다 파워 영역(월드 AABB 중심·크기). */
export function pylonPowerRects(
  entities: EntitySnap[],
  side: Side
): { x: number; z: number; w: number; d: number }[] {
  const rects: { x: number; z: number; w: number; d: number }[] = [];
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.side !== side || e.typeId !== "alien_pylon" || e.hp <= 0) continue;
    const size = pylonPowerSize(CELL);
    rects.push({
      x: e.x,
      z: e.z,
      w: size.w,
      d: size.d,
    });
  }
  return rects;
}

export function footprintFits(
  entities: EntitySnap[],
  side: Side,
  cx: number,
  cz: number,
  w: number,
  d: number,
  requirePower = false,
  ignoreIds?: ReadonlySet<string> | null
): boolean {
  const origin = footprintOrigin(cx, cz, w, d);
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const x = origin.cx + dx;
      const z = origin.cz + dz;
      if (!isBuildCell(side, x, z)) return false;
      if (cellBlocked(entities, x, z, ignoreIds)) return false;
    }
  }
  if (requirePower && !footprintPowered(entities, side, cx, cz, w, d)) {
    return false;
  }
  return true;
}

const GAS_W = 3;
const GAS_D = 3;

/** 분출구 3×3과 발자국이 같을 때만 유효. 이미 건물이 있으면 불가. */
export function etherFootprintFits(
  entities: EntitySnap[],
  side: Side,
  cx: number,
  cz: number,
  w: number,
  d: number,
  requirePower = false,
  ignoreIds?: ReadonlySet<string> | null
): boolean {
  if (w !== GAS_W || d !== GAS_D) return false;
  const origin = footprintOrigin(cx, cz, w, d);
  const gas = matchingEtherVent(entities, side, cx, cz, w, d);
  if (!gas) return false;
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const x = origin.cx + dx;
      const z = origin.cz + dz;
      if (x < 0 || z < 0 || x >= GRID_W || z >= GRID_D) return false;
      if (cellBlockedExceptGas(entities, x, z, ignoreIds)) return false;
    }
  }
  if (requirePower && !footprintPowered(entities, side, cx, cz, w, d)) {
    return false;
  }
  return true;
}

function cellBlockedExceptGas(
  entities: EntitySnap[],
  cx: number,
  cz: number,
  ignoreIds?: ReadonlySet<string> | null
): boolean {
  return entities.some((e) => {
    if (ignoreIds && ignoreIds.has(e.id)) return false;
    if (e.kind === "gas") return false;
    if (
      e.kind !== "hq" &&
      e.kind !== "building" &&
      e.kind !== "mineral" &&
      e.kind !== "unit" &&
      e.kind !== "worker" &&
      e.kind !== "larva" &&
      e.kind !== "egg"
    ) {
      return false;
    }
    return overlapsCell(e.x, e.z, e.kind, e.typeId, cx, cz);
  });
}

export function footprintCenter(
  cx: number,
  cz: number,
  w: number,
  d: number
): { x: number; z: number } {
  const origin = footprintOrigin(cx, cz, w, d);
  const a = cellCenter(origin.cx, origin.cz);
  const b = cellCenter(origin.cx + w - 1, origin.cz + d - 1);
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}

/** 건물·자원·유닛(일꾼·전투·유충·알)이 칸을 점유하면 true. ignoreIds 는 건설 일꾼 제외용. */
export function cellBlocked(
  entities: EntitySnap[],
  cx: number,
  cz: number,
  ignoreIds?: ReadonlySet<string> | null
): boolean {
  return entities.some((e) => {
    if (ignoreIds && ignoreIds.has(e.id)) return false;
    if (
      e.kind !== "hq" &&
      e.kind !== "building" &&
      e.kind !== "mineral" &&
      e.kind !== "gas" &&
      e.kind !== "unit" &&
      e.kind !== "worker" &&
      e.kind !== "larva" &&
      e.kind !== "egg"
    ) {
      return false;
    }
    return overlapsCell(e.x, e.z, e.kind, e.typeId, cx, cz);
  });
}

/** 유닛·일꾼·유충·알만 점유 (고스트에서 해당 셀만 빨강). */
export function cellHasUnit(
  entities: EntitySnap[],
  cx: number,
  cz: number,
  ignoreIds?: ReadonlySet<string> | null
): boolean {
  return entities.some((e) => {
    if (ignoreIds && ignoreIds.has(e.id)) return false;
    if (
      e.kind !== "unit" &&
      e.kind !== "worker" &&
      e.kind !== "larva" &&
      e.kind !== "egg"
    ) {
      return false;
    }
    return overlapsCell(e.x, e.z, e.kind, e.typeId, cx, cz);
  });
}

/** 발자국이 아군 에테르 분출구 3×3과 정확히 겹치면 그 분출구, 아니면 null. */
export function matchingEtherVent(
  entities: EntitySnap[],
  side: Side,
  cx: number,
  cz: number,
  w: number,
  d: number
): EntitySnap | null {
  if (w !== GAS_W || d !== GAS_D) return null;
  const origin = footprintOrigin(cx, cz, w, d);
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.kind !== "gas" || e.side !== side || e.hp <= 0) continue;
    const c = worldToCell(e.x, e.z);
    const gx = c.cx - Math.floor((GAS_W - 1) / 2);
    const gz = c.cz - Math.floor((GAS_D - 1) / 2);
    if (gx === origin.cx && gz === origin.cz) return e;
  }
  return null;
}

/** 고스트 칸별 표시. ok=초록, unit/blocked=빨강(유닛·건물·구역외·비스출구).
 *  gas 모드: 분출구와 정확히 겹칠 때만 초록 가능.
 *  allBlocked: 발자국이 파일런 범위 밖이면 칸 전체를 빨강으로 둔다. */
export function footprintGhostPads(
  entities: EntitySnap[],
  side: Side,
  cx: number,
  cz: number,
  w: number,
  d: number,
  ignoreIds?: ReadonlySet<string> | null,
  mode: "normal" | "gas" = "normal",
  requirePower = false,
  allBlocked = false
): { x: number; z: number; tone: "ok" | "unit" | "blocked" }[] {
  const origin = footprintOrigin(cx, cz, w, d);
  const onVent =
    mode === "gas"
      ? matchingEtherVent(entities, side, cx, cz, w, d) != null
      : false;
  const pads: { x: number; z: number; tone: "ok" | "unit" | "blocked" }[] = [];
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const gx = origin.cx + dx;
      const gz = origin.cz + dz;
      const c = cellCenter(gx, gz);
      let tone: "ok" | "unit" | "blocked" = "ok";
      if (allBlocked) {
        tone = "blocked";
      } else if (gx < 0 || gz < 0 || gx >= GRID_W || gz >= GRID_D) {
        tone = "blocked";
      } else if (mode === "gas" && !onVent) {
        // 분출구가 아니면 전 칸 빨강
        tone = "blocked";
      } else if (mode === "normal" && !isBuildCell(side, gx, gz)) {
        tone = "blocked";
      } else if (requirePower && !cellPowered(entities, side, gx, gz)) {
        tone = "blocked";
      } else if (cellHasUnit(entities, gx, gz, ignoreIds)) {
        tone = "unit";
      } else if (
        mode === "gas"
          ? cellBlockedExceptGas(entities, gx, gz, ignoreIds)
          : cellBlocked(entities, gx, gz, ignoreIds)
      ) {
        // 건물·사령부·미네랄 등과 겹침
        tone = "blocked";
      }
      pads.push({ x: c.x, z: c.z, tone });
    }
  }
  return pads;
}

/** 화면 좌표 → 월드 XZ. worldToScreenPercent 의 역변환. */
export function screenToWorld(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  side: Side,
  orthoHeight: number,
  camViewX = 0,
  camViewZ = 0
): { x: number; z: number } {
  const aspect = rect.width / Math.max(rect.height, 1);
  const halfW = orthoHeight * aspect;
  const nx = (clientX - rect.left) / rect.width;
  const ny = (clientY - rect.top) / rect.height;
  const vx = (nx - 0.5) * halfW * 2 + camViewX;
  const vz = (ny - 0.5) * orthoHeight * 2 + camViewZ;
  if (side === "top") return { x: vx, z: vz };
  return { x: -vx, z: -vz };
}
