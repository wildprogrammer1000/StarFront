import type { Side } from "../protocol";
import { GRID_D, GRID_W } from "./grid";
import { buildingDef, footprintOrigin } from "./roster";

/**
 * 서버 creep 비트열(16진, 월드 칸).
 * 뷰 좌표(아군 하단)로 그릴 때는 viewCellToWorld 로 뒤집는다.
 */

export function creepHas(packed: string, cx: number, cz: number): boolean {
  if (!packed) return false;
  if (cx < 0 || cz < 0 || cx >= GRID_W || cz >= GRID_D) return false;
  const i = cz * GRID_W + cx;
  const ni = i >> 2;
  if (ni >= packed.length) return false;
  const c = packed.charCodeAt(ni);
  let n = -1;
  if (c >= 48 && c <= 57) n = c - 48;
  else if (c >= 97 && c <= 102) n = c - 87;
  if (n < 0) return false;
  return ((n >> (i & 3)) & 1) === 1;
}

/** 괴물 건물은 발자국 전체가 크립 위일 때만 건설. 추가 산란소는 예외. */
export function needsCreep(typeId: string): boolean {
  const def = buildingDef(typeId);
  if (!def || def.race !== "monster") return false;
  if (typeId === "monster_hatch") return false;
  return true;
}

export function footprintOnCreep(
  packed: string,
  cx: number,
  cz: number,
  w: number,
  d: number
): boolean {
  const origin = footprintOrigin(cx, cz, w, d);
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      if (!creepHas(packed, origin.cx + dx, origin.cz + dz)) return false;
    }
  }
  return true;
}

const N = GRID_W * GRID_D;
/** 안개와 같은 칸 해상도. 선형 필터가 칸 사이를 잇는다. */
export const CREEP_TEX_W = GRID_W;
export const CREEP_TEX_H = GRID_D;
const creepHard = new Uint8Array(N);
const creepBlur = new Uint8Array(N);
/** 그리기 전용 알파. 판정은 creepHas 를 그대로 쓴다. */
const creepVisual = new Uint8Array(N);
let visualPacked = "";
let visualSide: Side | null = null;
let visualReady = false;

/** 안개와 동일. 가로·세로 각각 [1,4,6,4,1]/16. 경계 약 4칸을 완만하게 잇는다. */
const BLUR_W = [1, 4, 6, 4, 1];

function rebuildCreepVisual(packed: string, side: Side | null): void {
  if (visualReady && packed === visualPacked && side === visualSide) return;
  visualPacked = packed;
  visualSide = side;
  visualReady = true;
  for (let cz = 0; cz < GRID_D; cz++) {
    const row = cz * GRID_W;
    for (let cx = 0; cx < GRID_W; cx++) {
      const world = viewCellToWorld(cx, cz, side);
      creepHard[row + cx] = creepHas(packed, world.cx, world.cz) ? 255 : 0;
    }
  }
  for (let cz = 0; cz < GRID_D; cz++) {
    const row = cz * GRID_W;
    for (let cx = 0; cx < GRID_W; cx++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++) {
        let x = cx + k;
        if (x < 0) x = 0;
        else if (x >= GRID_W) x = GRID_W - 1;
        sum += creepHard[row + x] * BLUR_W[k + 2];
      }
      creepBlur[row + cx] = (sum + 8) >> 4;
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
        sum += creepBlur[z * GRID_W + cx] * BLUR_W[k + 2];
      }
      creepVisual[row + cx] = (sum + 8) >> 4;
    }
  }
}

let miniCanvas: HTMLCanvasElement | null = null;
let miniCtx: CanvasRenderingContext2D | null = null;
let miniImage: ImageData | null = null;

/** 미니맵. 안개와 같이 흐린 알파를 그대로 쓴다. */
export function paintCreepMinimap(
  ctx: CanvasRenderingContext2D,
  packed: string,
  side: Side | null,
  destW: number,
  destH: number
): void {
  rebuildCreepVisual(packed, side);
  if (!miniCanvas) {
    miniCanvas = document.createElement("canvas");
    miniCanvas.width = CREEP_TEX_W;
    miniCanvas.height = CREEP_TEX_H;
    miniCtx = miniCanvas.getContext("2d");
  }
  if (!miniCtx) return;
  if (!miniImage) miniImage = miniCtx.createImageData(CREEP_TEX_W, CREEP_TEX_H);
  const data = miniImage.data;
  data.fill(0);
  for (let i = 0; i < N; i++) {
    const a = creepVisual[i];
    if (!a) continue;
    const o = i * 4;
    data[o] = 128;
    data[o + 1] = 42;
    data[o + 2] = 150;
    data[o + 3] = a;
  }
  miniCtx.putImageData(miniImage, 0, 0);
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(miniCanvas, 0, 0, destW, destH);
  ctx.imageSmoothingEnabled = smooth;
}

/** 안개·바닥 텍스처와 같은 뷰 칸 → 서버 월드 칸 */
export function viewCellToWorld(
  cx: number,
  cz: number,
  side: Side | null
): { cx: number; cz: number } {
  if (side === "top") return { cx, cz };
  return { cx: GRID_W - 1 - cx, cz: GRID_D - 1 - cz };
}

/** 크립 마스크. 안쪽 알파는 255, 경계는 안개처럼 옅어진다. */
export function writeCreepRgba(
  out: Uint8ClampedArray,
  w: number,
  h: number,
  packed: string,
  side: Side | null
): void {
  rebuildCreepVisual(packed, side);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(CREEP_TEX_H - 1, Math.floor((y / h) * CREEP_TEX_H));
    const row = sy * CREEP_TEX_W;
    for (let x = 0; x < w; x++) {
      const sx = Math.min(CREEP_TEX_W - 1, Math.floor((x / w) * CREEP_TEX_W));
      const o = (y * w + x) * 4;
      out[o] = 255;
      out[o + 1] = 255;
      out[o + 2] = 255;
      out[o + 3] = creepVisual[row + sx];
    }
  }
}
