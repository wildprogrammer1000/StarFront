import type { EntitySnap } from "../protocol";

/**
 * 선택 중이던 알이 부화하면 그 유닛으로 선택을 잇는다.
 * 알 id 를 물려받은 첫 유닛은 그대로 두고, 칼날충 짝(hatchOf)도 넣는다.
 * 죽은 알·유닛은 선택에서 뺀다.
 */
export function followHatchedSelection(
  selectedIds: readonly string[],
  prev: readonly EntitySnap[],
  nextEntities: readonly EntitySnap[],
  max: number
): string[] {
  const alive = new Set<string>();
  for (let i = 0; i < nextEntities.length; i++) alive.add(nextEntities[i].id);
  const prevById = new Map<string, EntitySnap>();
  for (let i = 0; i < prev.length; i++) prevById.set(prev[i].id, prev[i]);
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (seen.has(id) || out.length >= max) return;
    if (!alive.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (let i = 0; i < selectedIds.length; i++) {
    const id = selectedIds[i];
    if (!alive.has(id)) continue;
    push(id);
    const was = prevById.get(id);
    const cur = nextEntities.find((e) => e.id === id);
    if (!was || !cur || was.kind !== "egg" || cur.kind === "egg") continue;
    for (let j = 0; j < nextEntities.length; j++) {
      if (nextEntities[j].hatchOf === id) push(nextEntities[j].id);
    }
  }
  return out;
}
