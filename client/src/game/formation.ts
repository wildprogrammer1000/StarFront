/** 미리보기용. 클릭 지점에 몸통만 피해서 붙는 자리. 실전은 서버가 장애물까지 보고 배정한다. */
const SLOT = 0.46;

export function formationPoints(
  _entities: { id: string; x: number; z: number }[],
  unitIds: string[],
  x: number,
  z: number
): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const n = unitIds.length;
  if (n === 0) return pts;
  pts.push({ x: x, z: z });
  let ring = 1;
  while (pts.length < n && ring < 8) {
    const radius = ring * SLOT;
    const count = 6 * ring;
    const turn = ring % 2 === 0 ? 0 : Math.PI / count;
    for (let i = 0; i < count && pts.length < n; i++) {
      const ang = (i / count) * Math.PI * 2 + turn;
      pts.push({
        x: x + Math.cos(ang) * radius,
        z: z + Math.sin(ang) * radius,
      });
    }
    ring += 1;
  }
  while (pts.length < n) pts.push({ x: x, z: z });
  return pts;
}
