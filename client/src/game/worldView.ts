import type { Side } from "../protocol";

/** 서버 WORLD 와 동일 (MAP 28×112 × cell 0.25 → 7×28) */
export const HALF_W = 3.5;
export const HALF_D = 14;

/**
 * 화면 가로에 맵 폭(HALF_W×2)을 딱 맞춤.
 * 세로는 종횡비에 따라 잘리므로 세로 패닝으로만 적 진영을 본다.
 */
export function viewOrthoHeight(aspect: number): number {
  const safe = Math.max(aspect, 0.01);
  return HALF_W / safe;
}

/** @deprecated viewOrthoHeight 사용 */
export const ORTHO_HEIGHT = HALF_W / (9 / 16);

/** @deprecated viewOrthoHeight 사용 */
export function orthoHeightForAspect(aspect: number): number {
  return viewOrthoHeight(aspect);
}

/** 가로는 맵에 고정(x=0). 세로만 클램프. */
export function clampCameraView(
  _camX: number,
  camZ: number,
  aspect: number
): { x: number; z: number } {
  const ortho = viewOrthoHeight(aspect);
  const maxZ = Math.max(0, HALF_D - ortho);
  return {
    x: 0,
    z: Math.max(-maxZ, Math.min(maxZ, camZ)),
  };
}

/**
 * 아군 본진(미네랄·사령부·에테르)이 화면 하단(+Z)에 붙도록 하는 홈 카메라.
 * 뷰포트 하단 = 맵 끝(HALF_D) — 본진 외곽이 바닥에 딱 맞음.
 */
export function homeCameraView(aspect: number): { x: number; z: number } {
  const ortho = viewOrthoHeight(aspect);
  return clampCameraView(0, HALF_D - ortho, aspect);
}

/** playcanvasApp toView 와 동일 — 아군이 화면 하단 */
export function toView(
  x: number,
  z: number,
  localSide: Side | null
): { x: number; z: number } {
  if (localSide === "top") {
    return { x, z };
  }
  return { x: -x, z: -z };
}

/**
 * 월드 XZ → 스테이지 CSS %.
 * camView 는 카메라가 바라보는 뷰 좌표 중심(가로는 항상 0).
 */
export function worldToScreenPercent(
  x: number,
  z: number,
  localSide: Side | null,
  aspect: number,
  camViewX = 0,
  camViewZ = 0
): { left: number; top: number } {
  const v = toView(x, z, localSide);
  const ortho = viewOrthoHeight(aspect);
  const halfW = ortho * Math.max(aspect, 0.01);
  const left = 50 + ((v.x - camViewX) / (halfW * 2)) * 100;
  const top = 50 + ((v.z - camViewZ) / (ortho * 2)) * 100;
  return { left, top };
}
