/**
 * 외계인 수정주 파워. 클라·서버가 같은 직사각형을 쓴다.
 * 가로 10칸 × 세로 6칸, 수정주 발자국 중심에 둔다.
 */
export const PYLON_POWER = { w: 10, d: 6 } as const;

export function pylonPowerSize(cell: number): { w: number; d: number } {
  return { w: PYLON_POWER.w * cell, d: PYLON_POWER.d * cell };
}

/** 칸 중심이 수정주 중심의 파워 직사각형 안에 있으면 true. */
export function cellInPylonPower(
  pylonX: number,
  pylonZ: number,
  cellX: number,
  cellZ: number,
  cell: number
): boolean {
  const halfW = (PYLON_POWER.w * cell) / 2;
  const halfD = (PYLON_POWER.d * cell) / 2;
  const eps = cell * 1e-4;
  return (
    Math.abs(cellX - pylonX) < halfW - eps &&
    Math.abs(cellZ - pylonZ) < halfD - eps
  );
}
