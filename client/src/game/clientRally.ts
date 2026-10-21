import type { EntitySnap, MatchSnapshot, PlayerInput } from "../protocol";

/**
 * 서버 생산 스폰 직후, 아군 신규 유닛·일꾼에게
 * 가장 가까운 랠리 보유 건물 좌표로 order_move 를 보낸다.
 */
export function issueClientRallyOrders(
  snap: MatchSnapshot,
  opts: {
    userId: string;
    matchId: string;
    seenIds: Set<string>;
    send: (matchId: string, input: PlayerInput) => void;
  }
): void {
  if (snap.status !== "playing") {
    opts.seenIds.clear();
    return;
  }

  let meSide: EntitySnap["side"] | null = null;
  for (let i = 0; i < snap.players.length; i++) {
    if (snap.players[i].userId === opts.userId) {
      meSide = snap.players[i].side;
      break;
    }
  }
  if (!meSide) return;

  const live = new Set<string>();
  for (let i = 0; i < snap.entities.length; i++) {
    live.add(snap.entities[i].id);
  }
  // 죽은 유닛 id 정리
  for (const id of Array.from(opts.seenIds)) {
    if (!live.has(id)) opts.seenIds.delete(id);
  }

  // 첫 playing 스냅샷: 기존 유닛은 시드만 (시작 배치에 명령 금지)
  if (opts.seenIds.size === 0) {
    for (let i = 0; i < snap.entities.length; i++) {
      opts.seenIds.add(snap.entities[i].id);
    }
    return;
  }

  const rallied: EntitySnap[] = [];
  for (let i = 0; i < snap.entities.length; i++) {
    const e = snap.entities[i];
    if (e.side !== meSide) continue;
    if (e.kind !== "building" && e.kind !== "hq") continue;
    if (typeof e.rallyX !== "number" || typeof e.rallyZ !== "number") continue;
    if (!Number.isFinite(e.rallyX) || !Number.isFinite(e.rallyZ)) continue;
    rallied.push(e);
  }
  if (rallied.length === 0) {
    for (let i = 0; i < snap.entities.length; i++) {
      opts.seenIds.add(snap.entities[i].id);
    }
    return;
  }

  for (let i = 0; i < snap.entities.length; i++) {
    const e = snap.entities[i];
    if (opts.seenIds.has(e.id)) continue;
    opts.seenIds.add(e.id);
    if (e.side !== meSide) continue;
    if (e.kind !== "unit" && e.kind !== "worker") continue;

    let best = rallied[0];
    let bestD =
      (e.x - best.x) * (e.x - best.x) + (e.z - best.z) * (e.z - best.z);
    for (let j = 1; j < rallied.length; j++) {
      const b = rallied[j];
      const d = (e.x - b.x) * (e.x - b.x) + (e.z - b.z) * (e.z - b.z);
      if (d < bestD) {
        best = b;
        bestD = d;
      }
    }
    opts.send(opts.matchId, {
      type: "order_move",
      unitId: e.id,
      x: best.rallyX as number,
      z: best.rallyZ as number,
    });
  }
}
