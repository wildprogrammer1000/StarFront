/** 그룹 이동·공격이동: 선택 순간의 상대 위치를 클릭 지점 주변에 유지한다. */
const MAX_OFFSET = 2.4;
const MIN_SPREAD = 0.28;

export function formationPoints(
  entities: { id: string; x: number; z: number }[],
  unitIds: string[],
  x: number,
  z: number
): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  if (unitIds.length <= 1) {
    for (let i = 0; i < unitIds.length; i++) pts.push({ x, z });
    return pts;
  }

  let cx = 0;
  let cz = 0;
  let n = 0;
  const pos: ({ x: number; z: number } | null)[] = [];
  for (let i = 0; i < unitIds.length; i++) {
    let found: { x: number; z: number } | null = null;
    for (let j = 0; j < entities.length; j++) {
      if (entities[j].id === unitIds[i]) {
        found = entities[j];
        break;
      }
    }
    pos.push(found);
    if (found) {
      cx += found.x;
      cz += found.z;
      n += 1;
    }
  }
  if (n === 0) {
    for (let i = 0; i < unitIds.length; i++) pts.push({ x, z });
    return pts;
  }
  cx /= n;
  cz /= n;

  for (let i = 0; i < unitIds.length; i++) {
    const p = pos[i];
    if (!p) {
      pts.push({ x, z });
      continue;
    }
    let ox = p.x - cx;
    let oz = p.z - cz;
    const len = Math.hypot(ox, oz);
    if (len < 0.05) {
      const ang = (i / unitIds.length) * Math.PI * 2;
      pts.push({
        x: x + Math.cos(ang) * MIN_SPREAD,
        z: z + Math.sin(ang) * MIN_SPREAD,
      });
      continue;
    }
    if (len > MAX_OFFSET) {
      ox *= MAX_OFFSET / len;
      oz *= MAX_OFFSET / len;
    }
    pts.push({ x: x + ox, z: z + oz });
  }
  return pts;
}
