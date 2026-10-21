import type { EntitySnap, MatchSnapshot } from "../protocol";

type Listener = () => void;

let current: MatchSnapshot | null = null;
const listeners = new Set<Listener>();

export function pushSnapshot(snap: MatchSnapshot): void {
  current = snap;
  listeners.forEach((fn) => fn());
}

export function clearSnapshot(): void {
  current = null;
  listeners.forEach((fn) => fn());
}

export function getSnapshot(): MatchSnapshot | null {
  return current;
}

export function getEntities(): EntitySnap[] {
  return current?.entities ?? [];
}

/** 입력 직후 서버 스냅샷 전 월드/선택 표시를 맞추기 위한 낙관적 패치. */
export function patchEntities(
  patch: (entities: EntitySnap[]) => EntitySnap[]
): void {
  if (!current) return;
  // tick을 미세하게 올려 React 스로틀 스냅샷(동일 tick)에 덮어쓰이지 않게 한다.
  pushSnapshot({
    ...current,
    tick: current.tick + 0.001,
    entities: patch(current.entities.map((e) => ({ ...e }))),
  });
}

export function subscribeSnapshot(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React HUD용: playing 중에는 너무 자주 setState 하지 않도록 판별. */
export function shouldMirrorToReact(
  prev: MatchSnapshot | null,
  next: MatchSnapshot,
  lastMirrorAt: number,
  now: number,
  hudIntervalMs = 200
): boolean {
  if (!prev) return true;
  if (prev.status !== next.status) return true;
  if (next.status !== "playing") return true;
  if (now - lastMirrorAt >= hudIntervalMs) return true;
  if (playersHudChanged(prev, next)) return true;
  return false;
}

function playersHudChanged(a: MatchSnapshot, b: MatchSnapshot): boolean {
  if (a.players.length !== b.players.length) return true;
  for (let i = 0; i < a.players.length; i++) {
    const p = a.players[i];
    const q = b.players[i];
    if (!q || p.userId !== q.userId) return true;
    if (p.energy !== q.energy || p.minerals !== q.minerals) return true;
    if (p.supply !== q.supply || p.supplyMax !== q.supplyMax) return true;
    if (p.race !== q.race || p.side !== q.side) return true;
  }
  return false;
}
