import type { EntitySnap, Side } from "../protocol";
import { groundFoot } from "./entityFoot";
import { ventCovered } from "./gasVent";
import { fogRevealsEntity } from "./fog";
import { worldToScreenPercent } from "./worldView";

/** SC식 컨트롤 그룹 — 한 번에 선택 가능한 최대 유닛 수 */
export const MAX_SELECT = 10;

const SELECTABLE = new Set([
  "hq",
  "building",
  "unit",
  "worker",
  "mineral",
  "gas",
  "egg",
  "larva",
]);
/** 드래그 박스 선택 — 이동 유닛과 유충 */
const DRAG_KINDS = new Set(["unit", "worker", "larva"]);
/** 유닛이 없을 때 드래그 폴백 — 아군 건물·사령부 */
const DRAG_BUILDING_KINDS = new Set(["building", "hq"]);

function hitRadius(e: EntitySnap): number {
  switch (e.kind) {
    case "hq":
      return 1.05;
    case "building":
      return 0.7;
    case "mineral":
      return 0.55;
    case "gas":
      return 0.55;
    case "worker":
      return 0.4;
    case "egg":
      return 0.35;
    case "larva":
      return 0.28;
    default:
      if (e.typeId === "monster_blade") return 0.3;
      return 0.45;
  }
}

const ATTACK_KINDS = new Set(["unit", "worker", "building", "hq"]);

/** 공격 클릭의 직접 타겟. 아군·적 유닛과 건물. 빈 땅만 공격이동. */
export function enemyAttackTarget(
  hit: EntitySnap | null,
  side: Side | null,
  attackerIds: readonly string[]
): hit is EntitySnap {
  if (!hit || !side || hit.hp <= 0) return false;
  if (attackerIds.indexOf(hit.id) >= 0) return false;
  return ATTACK_KINDS.has(hit.kind);
}

/** 손가락이 스프라이트 가장자리에 걸쳐도 잡히게 하는 여유. 바닥 탭은 넘지 않는다. */
const ATTACK_PAD = 0.12;

function attackPointHits(
  e: EntitySnap,
  x: number,
  z: number,
  px: number,
  pz: number
): boolean {
  const foot = groundFoot(e);
  return (
    Math.abs(px - x) <= foot.w * 0.5 + ATTACK_PAD &&
    Math.abs(pz - z) <= foot.d * 0.5 + ATTACK_PAD
  );
}

/**
 * 공격 명령 클릭. 스프라이트 안이면 그 유닛·건물을 타겟으로 고른다.
 * 겹치면 더 작은 몸통(유닛이 건물보다 우선)을 고른다.
 * 맞는 대상이 없으면 호출측이 그 좌표로 공격이동한다.
 * renderedAt 이 있으면 화면에 그려진 위치로 판정한다.
 */
export function pickAttackTargetAt(
  entities: EntitySnap[],
  x: number,
  z: number,
  side: Side | null,
  attackerIds: readonly string[],
  renderedAt?: (e: EntitySnap) => { x: number; z: number } | null
): EntitySnap | null {
  let best: EntitySnap | null = null;
  let bestArea = Infinity;
  let bestD = Infinity;
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (!enemyAttackTarget(e, side, attackerIds)) continue;
    if (!canPick(e, side) || e.inside) continue;
    const drawn = renderedAt ? renderedAt(e) : null;
    const px = drawn ? drawn.x : e.x;
    const pz = drawn ? drawn.z : e.z;
    if (!attackPointHits(e, x, z, px, pz)) continue;
    const foot = groundFoot(e);
    const area = foot.w * foot.d;
    const d = Math.hypot(px - x, pz - z);
    const smaller = area < bestArea - 1e-4;
    const tied = Math.abs(area - bestArea) <= 1e-4;
    if (smaller || (tied && d < bestD)) {
      best = e;
      bestArea = area;
      bestD = d;
    }
  }
  return best;
}

/** 아군·상대 모두 선택. 자원은 어느 진영이든 정보 확인용으로 집힌다. */
export function pickEntityAt(
  entities: EntitySnap[],
  x: number,
  z: number,
  side: Side | null
): EntitySnap | null {
  let best: EntitySnap | null = null;
  let bestD = Infinity;
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (!canPick(e, side)) continue;
    if (e.inside) continue;
    if (e.kind === "gas" && ventCovered(entities, e)) continue;
    const d = Math.hypot(e.x - x, e.z - z);
    const r = hitRadius(e);
    if (d <= r && d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

function overlapsBox(
  e: EntitySnap,
  loX: number,
  hiX: number,
  loZ: number,
  hiZ: number
): boolean {
  const foot = groundFoot(e);
  const hx = foot.w * 0.5;
  const hz = foot.d * 0.5;
  return !(
    e.x + hx < loX ||
    e.x - hx > hiX ||
    e.z + hz < loZ ||
    e.z - hz > hiZ
  );
}

/**
 * 드래그 박스와 스프라이트 발자국이 겹치는 아군 유닛·일꾼·유충.
 * 히트 반경으로 박스를 키우지 않는다.
 * 유닛이 없으면 박스와 겹치는 건물 중 end(드래그 종료점)에 가장 가까운 1채.
 */
export function pickEntitiesInBox(
  entities: EntitySnap[],
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  side: Side,
  endX?: number,
  endZ?: number
): string[] {
  const loX = Math.min(minX, maxX);
  const hiX = Math.max(minX, maxX);
  const loZ = Math.min(minZ, maxZ);
  const hiZ = Math.max(minZ, maxZ);
  const ids: string[] = [];
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.side !== side || !DRAG_KINDS.has(e.kind) || e.inside) continue;
    if (!overlapsBox(e, loX, hiX, loZ, hiZ)) continue;
    ids.push(e.id);
    if (ids.length >= MAX_SELECT) break;
  }
  if (ids.length > 0) return ids;

  const tipX = endX ?? (loX + hiX) * 0.5;
  const tipZ = endZ ?? (loZ + hiZ) * 0.5;
  let best: EntitySnap | null = null;
  let bestD = Infinity;
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.side !== side || !DRAG_BUILDING_KINDS.has(e.kind)) continue;
    if (!overlapsBox(e, loX, hiX, loZ, hiZ)) continue;
    const d = Math.hypot(e.x - tipX, e.z - tipZ);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best ? [best.id] : [];
}

export interface ScreenView {
  side: Side;
  aspect: number;
  camX: number;
  camZ: number;
}

/** 화면 가장자리에 걸친 유닛도 포함한다 */
const VIEW_PAD_PCT = 3;

function centerOnScreen(e: EntitySnap, view: ScreenView): boolean {
  const p = worldToScreenPercent(
    e.x,
    e.z,
    view.side,
    view.aspect,
    view.camX,
    view.camZ
  );
  return (
    p.left >= -VIEW_PAD_PCT &&
    p.left <= 100 + VIEW_PAD_PCT &&
    p.top >= -VIEW_PAD_PCT &&
    p.top <= 100 + VIEW_PAD_PCT
  );
}

/**
 * 더블 클릭·탭 — 현재 화면에 보이는 같은 종류(typeId·kind) 아군.
 * 10기를 넘으면 클릭한 유닛에 가까운 순으로 자르고, 클릭 대상은 항상 첫 번째.
 */
export function pickSameUnitsInView(
  entities: EntitySnap[],
  hit: EntitySnap,
  view: ScreenView
): string[] {
  if (hit.side !== view.side || !DRAG_KINDS.has(hit.kind)) return [hit.id];

  const ranked: { id: string; d: number; i: number }[] = [];
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.side !== view.side || e.kind !== hit.kind || e.typeId !== hit.typeId) {
      continue;
    }
    if (e.inside) continue;
    if (!fogRevealsEntity(e, view.side)) continue;
    if (e.id !== hit.id && !centerOnScreen(e, view)) continue;
    ranked.push({
      id: e.id,
      d: Math.hypot(e.x - hit.x, e.z - hit.z),
      i,
    });
  }
  ranked.sort((a, b) => {
    if (a.id === hit.id) return -1;
    if (b.id === hit.id) return 1;
    if (a.d !== b.d) return a.d - b.d;
    return a.i - b.i;
  });
  if (!ranked.length) return [hit.id];
  return ranked.slice(0, MAX_SELECT).map((row) => row.id);
}

function canPick(e: EntitySnap, side: Side | null): boolean {
  if (!SELECTABLE.has(e.kind)) return false;
  if (!fogRevealsEntity(e, side)) return false;
  if (!side || e.side === side) return true;
  return (
    e.kind === "hq" ||
    e.kind === "building" ||
    e.kind === "unit" ||
    e.kind === "worker" ||
    e.kind === "mineral" ||
    e.kind === "gas"
  );
}
