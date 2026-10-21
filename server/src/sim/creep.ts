/**
 * 스타1 저그 크립.
 * - 괴물 사령부·번식지는 넓은 반경, 그 외 건물은 좁은 반경.
 * - 시작 부화장은 반경이 이미 채워진 상태.
 * - 이후 건물은 발자국부터 한 칸씩 퍼지고, 건물이 없으면 바깥부터 걷힌다.
 * - 괴물 건물은 발자국 전체가 크립 위일 때만 건설.
 * - 누구의 크립이든 건설 가능. 지상 괴물 유닛은 크립 위에서 4/3 배속.
 * Goja: for..of / Map / 스프레드 금지.
 */
import { FOOTPRINT, MAP, TICK_DT, WORLD } from "./constants";
import { buildingDef, footprintOf } from "./roster";
import { isAirUnit } from "@shared/unitLayers";

/** 건물 칸에서부터의 유클리드 반경(칸) */
const HQ_RADIUS = 12;
const BUILDING_RADIUS = 6;
/** 한 칸 확산·후퇴 간격(초). 후퇴가 더 느리다. */
const SPREAD_SEC = 0.8;
const RECEDE_SEC = 1.2;
const SPEED_MUL = 4 / 3;

const W = MAP.width;
const D = MAP.depth;
const N = W * D;
const NIBBLES = Math.ceil(N / 4);
const HEX = "0123456789abcdef";

export interface CreepEntity {
  kind: string;
  typeId: string;
  x: number;
  z: number;
  hp: number;
}

export interface CreepState {
  creep: string;
  creepSpread: number;
  creepRecede: number;
  entities: { [id: string]: CreepEntity };
}

export function emptyCreep(): string {
  let out = "";
  for (let i = 0; i < NIBBLES; i++) out += "0";
  return out;
}

export function buildingNeedsCreep(typeId: string): boolean {
  const def = buildingDef(typeId);
  if (!def || def.race !== "monster") return false;
  if (typeId === "monster_hatch") return false;
  return true;
}

export function footprintOnCreep(
  sim: CreepState,
  ox: number,
  oz: number,
  w: number,
  d: number
): boolean {
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      if (!creepBit(sim.creep, ox + dx, oz + dz)) return false;
    }
  }
  return true;
}

/** 지상 괴물만. 대군주 등 공중은 그대로. */
export function speedOnCreep(
  sim: CreepState,
  typeId: string,
  kind: string,
  x: number,
  z: number,
  base: number
): number {
  if (kind !== "worker" && kind !== "unit") return base;
  if (typeId.indexOf("monster") !== 0) return base;
  if (isAirUnit(typeId)) return base;
  const cell = worldToCell(x, z);
  if (!creepBit(sim.creep, cell.cx, cell.cz)) return base;
  return base * SPEED_MUL;
}

/** 경기 시작: 부화장 반경을 한 번에 채운다. */
export function fillStartingCreep(sim: CreepState): void {
  sim.creep = encode(buildAllow(sim));
  sim.creepSpread = 0;
  sim.creepRecede = 0;
}

export function tickCreep(sim: CreepState): void {
  if (typeof sim.creep !== "string" || sim.creep.length !== NIBBLES) {
    sim.creep = emptyCreep();
  }
  if (typeof sim.creepSpread !== "number") sim.creepSpread = 0;
  if (typeof sim.creepRecede !== "number") sim.creepRecede = 0;

  const cells = decode(sim.creep);
  let changed = stampFootprints(sim, cells);

  sim.creepSpread += TICK_DT;
  sim.creepRecede += TICK_DT;

  const allow =
    sim.creepSpread >= SPREAD_SEC || sim.creepRecede >= RECEDE_SEC
      ? buildAllow(sim)
      : null;

  if (sim.creepSpread >= SPREAD_SEC && allow) {
    sim.creepSpread -= SPREAD_SEC;
    if (sim.creepSpread > SPREAD_SEC) sim.creepSpread = 0;
    if (spreadLayer(cells, allow)) changed = true;
  }
  if (sim.creepRecede >= RECEDE_SEC && allow) {
    sim.creepRecede -= RECEDE_SEC;
    if (sim.creepRecede > RECEDE_SEC) sim.creepRecede = 0;
    if (recedeLayer(cells, allow)) changed = true;
  }

  if (changed) sim.creep = encode(cells);
}

function creepBit(packed: string, cx: number, cz: number): boolean {
  if (cx < 0 || cz < 0 || cx >= W || cz >= D) return false;
  if (!packed) return false;
  const i = cz * W + cx;
  const ni = i >> 2;
  if (ni < 0 || ni >= packed.length) return false;
  const c = packed.charCodeAt(ni);
  let n = -1;
  if (c >= 48 && c <= 57) n = c - 48;
  else if (c >= 97 && c <= 102) n = c - 87;
  if (n < 0) return false;
  return ((n >> (i & 3)) & 1) === 1;
}

function worldToCell(x: number, z: number): { cx: number; cz: number } {
  return {
    cx: Math.floor((x + WORLD.halfWidth) / MAP.cellSize),
    cz: Math.floor((z + WORLD.halfDepth) / MAP.cellSize),
  };
}

function originOf(
  x: number,
  z: number,
  w: number,
  d: number
): { cx: number; cz: number } {
  return {
    cx: Math.round((x + WORLD.halfWidth) / MAP.cellSize - w / 2),
    cz: Math.round((z + WORLD.halfDepth) / MAP.cellSize - d / 2),
  };
}

function isSource(e: CreepEntity): boolean {
  if (!e || e.hp <= 0) return false;
  if (e.typeId.indexOf("monster") !== 0) return false;
  return e.kind === "hq" || e.kind === "building";
}

function radiusOf(e: CreepEntity): number {
  if (e.kind === "hq" || e.typeId === "monster_hatchery" || e.typeId === "monster_hatch") {
    return HQ_RADIUS;
  }
  return BUILDING_RADIUS;
}

function sizeOf(e: CreepEntity): { w: number; d: number } {
  if (e.kind === "hq") return { w: FOOTPRINT.hq.w, d: FOOTPRINT.hq.d };
  return footprintOf(e.typeId);
}

function eachSource(sim: CreepState, fn: (e: CreepEntity) => void): void {
  const entities = sim.entities;
  for (const k in entities) {
    if (!Object.prototype.hasOwnProperty.call(entities, k)) continue;
    const e = entities[k];
    if (isSource(e)) fn(e);
  }
}

function blank(): number[] {
  const cells: number[] = [];
  for (let i = 0; i < N; i++) cells.push(0);
  return cells;
}

function buildAllow(sim: CreepState): number[] {
  const allow = blank();
  eachSource(sim, function (e) {
    const fp = sizeOf(e);
    const o = originOf(e.x, e.z, fp.w, fp.d);
    const r = radiusOf(e);
    const r2 = r * r;
    const x0 = o.cx - r;
    const z0 = o.cz - r;
    const x1 = o.cx + fp.w - 1 + r;
    const z1 = o.cz + fp.d - 1 + r;
    for (let cz = z0; cz <= z1; cz++) {
      if (cz < 0 || cz >= D) continue;
      for (let cx = x0; cx <= x1; cx++) {
        if (cx < 0 || cx >= W) continue;
        let best = r2 + 1;
        for (let fz = 0; fz < fp.d; fz++) {
          const dz = cz - (o.cz + fz);
          for (let fx = 0; fx < fp.w; fx++) {
            const dx = cx - (o.cx + fx);
            const d2 = dx * dx + dz * dz;
            if (d2 < best) best = d2;
          }
        }
        if (best <= r2) allow[cz * W + cx] = 1;
      }
    }
  });
  return allow;
}

function stampFootprints(sim: CreepState, cells: number[]): boolean {
  let changed = false;
  eachSource(sim, function (e) {
    const fp = sizeOf(e);
    const o = originOf(e.x, e.z, fp.w, fp.d);
    for (let dz = 0; dz < fp.d; dz++) {
      const cz = o.cz + dz;
      if (cz < 0 || cz >= D) continue;
      for (let dx = 0; dx < fp.w; dx++) {
        const cx = o.cx + dx;
        if (cx < 0 || cx >= W) continue;
        const i = cz * W + cx;
        if (!cells[i]) {
          cells[i] = 1;
          changed = true;
        }
      }
    }
  });
  return changed;
}

function neighborCreep(cells: number[], cx: number, cz: number): boolean {
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      const x = cx + dx;
      const z = cz + dz;
      if (x < 0 || z < 0 || x >= W || z >= D) continue;
      if (cells[z * W + x]) return true;
    }
  }
  return false;
}

function exposed(cells: number[], cx: number, cz: number): boolean {
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      const x = cx + dx;
      const z = cz + dz;
      if (x < 0 || z < 0 || x >= W || z >= D) return true;
      if (!cells[z * W + x]) return true;
    }
  }
  return false;
}

function spreadLayer(cells: number[], allow: number[]): boolean {
  const next = blank();
  for (let i = 0; i < N; i++) next[i] = cells[i];
  let changed = false;
  for (let i = 0; i < N; i++) {
    if (cells[i] || !allow[i]) continue;
    const cx = i % W;
    const cz = (i / W) | 0;
    if (!neighborCreep(cells, cx, cz)) continue;
    next[i] = 1;
    changed = true;
  }
  if (!changed) return false;
  for (let i = 0; i < N; i++) cells[i] = next[i];
  return true;
}

function recedeLayer(cells: number[], allow: number[]): boolean {
  const next = blank();
  for (let i = 0; i < N; i++) next[i] = cells[i];
  let changed = false;
  for (let i = 0; i < N; i++) {
    if (!cells[i] || allow[i]) continue;
    const cx = i % W;
    const cz = (i / W) | 0;
    if (!exposed(cells, cx, cz)) continue;
    next[i] = 0;
    changed = true;
  }
  if (!changed) return false;
  for (let i = 0; i < N; i++) cells[i] = next[i];
  return true;
}

function decode(hex: string): number[] {
  const cells = blank();
  const src = hex || "";
  for (let i = 0; i < N; i++) {
    const ni = i >> 2;
    if (ni >= src.length) break;
    const c = src.charCodeAt(ni);
    let n = -1;
    if (c >= 48 && c <= 57) n = c - 48;
    else if (c >= 97 && c <= 102) n = c - 87;
    if (n >= 0 && (n >> (i & 3)) & 1) cells[i] = 1;
  }
  return cells;
}

function encode(cells: number[]): string {
  let out = "";
  for (let n = 0; n < NIBBLES; n++) {
    let bits = 0;
    for (let b = 0; b < 4; b++) {
      const i = n * 4 + b;
      if (i < N && cells[i]) bits |= 1 << b;
    }
    out += HEX.charAt(bits);
  }
  return out;
}
