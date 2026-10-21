import type { EntitySnap, Side } from "../protocol";
import { CELL, GRID_D, GRID_W, HALF_D, HALF_W } from "./grid";
import { toView } from "./worldView";

/** 시야 반경 (월드 단위) — SC1식 대략값 */
export function sightRadius(e: EntitySnap): number {
  switch (e.kind) {
    case "hq":
      return 5.0;
    case "building":
      if (e.typeId === "monster_hatch") return 5.0;
      if (e.typeId === "alien_pylon") return 4.0;
      if (e.typeId.indexOf("depot") >= 0) return 3.0;
      return 3.5;
    case "worker":
      return 2.75;
    case "unit":
      return 3.5;
    case "larva":
      return 1.75;
    default:
      return 0;
  }
}

function providesSight(e: EntitySnap): boolean {
  return (
    e.kind === "hq" ||
    e.kind === "building" ||
    e.kind === "worker" ||
    e.kind === "unit" ||
    e.kind === "larva"
  );
}

const N = GRID_W * GRID_D;
const explored = new Uint8Array(N);
const visible = new Uint8Array(N);
/** 그리기 전용. 시야 판정은 visible/explored 를 그대로 쓴다. */
const visual = new Uint8Array(N);
const blurRow = new Uint8Array(N);
visual.fill(255);
let fogSide: Side | null = null;
let revision = 0;

/** 가로·세로 각각 [1,4,6,4,1]/16. 경계 약 4칸을 완만하게 잇는다. */
const BLUR_W = [1, 4, 6, 4, 1];

export function getFogRevision(): number {
  return revision;
}

export function getFogExplored(): Uint8Array {
  return explored;
}

export function getFogVisible(): Uint8Array {
  return visible;
}

export function resetFog(side: Side | null): void {
  explored.fill(0);
  visible.fill(0);
  fogSide = side;
  rebuildVisual();
  revision++;
}

function idx(cx: number, cz: number): number {
  return cz * GRID_W + cx;
}

export function viewToFogCell(
  vx: number,
  vz: number
): { cx: number; cz: number } {
  return {
    cx: Math.floor((vx + HALF_W) / CELL),
    cz: Math.floor((vz + HALF_D) / CELL),
  };
}

export function isFogVisibleAtView(vx: number, vz: number): boolean {
  const { cx, cz } = viewToFogCell(vx, vz);
  if (cx < 0 || cz < 0 || cx >= GRID_W || cz >= GRID_D) return false;
  return visible[idx(cx, cz)] !== 0;
}

export function isFogExploredAtView(vx: number, vz: number): boolean {
  const { cx, cz } = viewToFogCell(vx, vz);
  if (cx < 0 || cz < 0 || cx >= GRID_W || cz >= GRID_D) return false;
  return explored[idx(cx, cz)] !== 0;
}

function paintSight(vx: number, vz: number, radius: number): void {
  if (radius <= 0) return;
  const r2 = radius * radius;
  const minCx = Math.max(0, Math.floor((vx - radius + HALF_W) / CELL));
  const maxCx = Math.min(GRID_W - 1, Math.floor((vx + radius + HALF_W) / CELL));
  const minCz = Math.max(0, Math.floor((vz - radius + HALF_D) / CELL));
  const maxCz = Math.min(GRID_D - 1, Math.floor((vz + radius + HALF_D) / CELL));
  for (let cz = minCz; cz <= maxCz; cz++) {
    const cellZ = -HALF_D + (cz + 0.5) * CELL;
    const dz = cellZ - vz;
    for (let cx = minCx; cx <= maxCx; cx++) {
      const cellX = -HALF_W + (cx + 0.5) * CELL;
      const dx = cellX - vx;
      if (dx * dx + dz * dz <= r2) {
        visible[idx(cx, cz)] = 1;
      }
    }
  }
}

/**
 * 아군 시야로 visible 갱신, explored 누적.
 * 좌표는 뷰 공간(아군 하단) 기준.
 */
export function syncFog(entities: EntitySnap[], localSide: Side | null): void {
  if (localSide !== fogSide) {
    resetFog(localSide);
  }
  visible.fill(0);
  if (!localSide) {
    rebuildVisual();
    revision++;
    return;
  }
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.side !== localSide || !providesSight(e) || e.inside) continue;
    const v = toView(e.x, e.z, localSide);
    paintSight(v.x, v.z, sightRadius(e));
  }
  for (let i = 0; i < N; i++) {
    if (visible[i]) explored[i] = 1;
  }
  rebuildVisual();
  revision++;
}

function hardAlpha(i: number): number {
  if (!explored[i]) return 255;
  if (!visible[i]) return 150;
  return 0;
}

function rebuildVisual(): void {
  for (let cz = 0; cz < GRID_D; cz++) {
    const row = cz * GRID_W;
    for (let cx = 0; cx < GRID_W; cx++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++) {
        let x = cx + k;
        if (x < 0) x = 0;
        else if (x >= GRID_W) x = GRID_W - 1;
        sum += hardAlpha(row + x) * BLUR_W[k + 2];
      }
      blurRow[row + cx] = (sum + 8) >> 4;
    }
  }
  for (let cz = 0; cz < GRID_D; cz++) {
    const row = cz * GRID_W;
    for (let cx = 0; cx < GRID_W; cx++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++) {
        let z = cz + k;
        if (z < 0) z = 0;
        else if (z >= GRID_D) z = GRID_D - 1;
        sum += blurRow[z * GRID_W + cx] * BLUR_W[k + 2];
      }
      visual[row + cx] = (sum + 8) >> 4;
    }
  }
}

/**
 * SC1: 아군·시야 안 적 유닛/건물·탐험된 자원 표시.
 * 미탐험·시야 밖 적 유닛/건물은 숨김.
 */
export function fogRevealsEntity(
  e: EntitySnap,
  localSide: Side | null
): boolean {
  if (!localSide) return true;
  if (e.side === localSide) return true;
  const v = toView(e.x, e.z, localSide);
  if (e.kind === "mineral" || e.kind === "gas") {
    return isFogExploredAtView(v.x, v.z);
  }
  if (
    e.kind === "hq" ||
    e.kind === "building" ||
    e.kind === "worker" ||
    e.kind === "unit" ||
    e.kind === "larva" ||
    e.kind === "egg"
  ) {
    return isFogVisibleAtView(v.x, v.z);
  }
  return isFogExploredAtView(v.x, v.z);
}

/** 텍스처/미니맵용: A=안개 농도 (255=완전 암흑, 0=밝음) */
export function fogAlphaAt(cx: number, cz: number): number {
  if (cx < 0 || cz < 0 || cx >= GRID_W || cz >= GRID_D) return 255;
  return visual[idx(cx, cz)];
}

/** RGBA 버퍼에 안개 쓰기. height 행은 뷰 +Z(하단)가 이미지 아래. */
export function writeFogRgba(out: Uint8ClampedArray, w: number, h: number): void {
  for (let y = 0; y < h; y++) {
    const cz = Math.min(GRID_D - 1, Math.floor((y / h) * GRID_D));
    for (let x = 0; x < w; x++) {
      const cx = Math.min(GRID_W - 1, Math.floor((x / w) * GRID_W));
      const a = fogAlphaAt(cx, cz);
      const o = (y * w + x) * 4;
      out[o] = 0;
      out[o + 1] = 0;
      out[o + 2] = 0;
      out[o + 3] = a;
    }
  }
}
