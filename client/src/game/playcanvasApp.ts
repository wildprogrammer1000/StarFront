import * as pc from "playcanvas";
import type { EntitySnap, HitSnap, MatchSnapshot, Side } from "../protocol";
import {
  fogRevealsEntity,
  isFogVisibleAtView,
  resetFog,
  syncFog,
  viewToFogCell,
  writeFogRgba,
} from "./fog";
import {
  CELL,
  GRID_D,
  GRID_W,
  HALF_D,
  HALF_W,
  NEUTRAL_HALF_D,
} from "./grid";
import { ventCovered } from "./gasVent";
import { footprintOf } from "./roster";
import { attackerSpan, gridFoot, groundFoot } from "./entityFoot";
import { CREEP_TEX_H, CREEP_TEX_W, writeCreepRgba } from "./creep";
import {
  CREEP_URL,
  FLOOR_MAP_URL,
  getCachedImage,
  preloadBattleAssets,
  attackSprite,
  buildingDamageFx,
  dieFxFrames,
  hitFx,
  spriteUrl,
  SPRITE_URL,
  walkFrames,
} from "./sprites";
import {
  clampCameraView,
  homeCameraView,
  viewOrthoHeight,
  worldToScreenPercent,
  toView as toViewCoords,
} from "./worldView";

const GROUND_Y = 0;
/** 탑뷰에서 건물·사령부보다 앞에 보이도록 유닛을 더 높게 둔다. */
const ACTOR_Y = 1.25;
/** 랠리 점선·마커 — 건물 스프라이트(y≈0.08) 위 */
const RALLY_Y = GROUND_Y + 0.42;
/** 월드 단위당 점선 반복 길이 (대시+간격) */
const RALLY_DASH_PERIOD = 0.26;
const RALLY_LINE_WIDTH = 0.045;
const RALLY_SCROLL_SPEED = 1.35;
const RALLY_MARKER_SIZE = 0.4;
const MARKER_PULSE_SPEED = 3.2;
const MARKER_SPIN_DEG = 28;

export interface GhostPad {
  x: number;
  z: number;
  /** ok=초록, unit=유닛 점유 빨강, blocked=그 외 장애 */
  tone: "ok" | "unit" | "blocked";
}

export interface GhostCell {
  x: number;
  z: number;
  w: number;
  d: number;
  valid: boolean;
  /** 배치 미리보기 스프라이트 typeId */
  typeId?: string;
  /** 칸별 바닥 표시. 없으면 전체 패드로 폴백 */
  pads?: GhostPad[];
}

export interface PowerRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface CameraView {
  x: number;
  z: number;
  ortho: number;
  aspect: number;
}

export interface PlayCanvasHandle {
  applySnapshot: (snap: MatchSnapshot) => void;
  setLocalSide: (side: Side | null) => void;
  setGhost: (ghost: GhostCell | null) => void;
  setPowerFields: (rects: PowerRect[]) => void;
  setSelectedIds: (ids: string[]) => void;
  getCameraView: () => CameraView;
  /** 화면에 보간된 유닛 월드 좌표. 정지 물체는 null. */
  getRenderedXZ: (id: string) => { x: number; z: number } | null;
  setCameraView: (x: number, z: number) => void;
  panCamera: (dViewX: number, dViewZ: number) => void;
  goHomeCamera: () => void;
  /** 바닥·유닛 스프라이트 GPU 업로드까지 완료 */
  whenAssetsReady: () => Promise<void>;
  destroy: () => void;
  canvas: HTMLCanvasElement;
  mouse: pc.Mouse;
  touch: pc.TouchDevice;
}

/**
 * XZ 탑뷰 (클래시 스타일):
 * - 아군 기지 = 화면 하단, 적 기지 = 화면 상단
 * - 카메라 (0,20,0) → 원점 수직 탑뷰
 */
export function createPlayCanvasApp(
  canvas: HTMLCanvasElement
): PlayCanvasHandle {
  const mouse = new pc.Mouse(canvas);
  const touch = new pc.TouchDevice(canvas);
  const app = new pc.Application(canvas, {
    mouse,
    touch,
    graphicsDeviceOptions: {
      alpha: false,
      antialias: true,
    },
  });

  // GraphicsDevice 기본은 maxPixelRatio=1 이라 레티나에서도 뭉개진다. 상한을 높여 둔다.
  app.graphicsDevice.maxPixelRatio = Math.max(window.devicePixelRatio || 1, 2);

  app.start();
  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  let localSide: Side | null = "bottom";

  const camera = new pc.Entity("camera");
  camera.addComponent("camera", {
    clearColor: new pc.Color(0.07, 0.09, 0.12),
    projection: pc.PROJECTION_ORTHOGRAPHIC,
    nearClip: 0.1,
    farClip: 100,
    orthoHeight: viewOrthoHeight(9 / 16),
  });
  // lookAt(원점)은 수직일 때 up 벡터가 붕괴하므로 euler 사용
  let camViewX = 0;
  let camViewZ = 0;
  let camAspect = 9 / 16;
  const home = homeCameraView(camAspect);
  camViewX = home.x;
  camViewZ = home.z;
  camera.setPosition(camViewX, 20, camViewZ);
  camera.setEulerAngles(-90, 0, 0);
  app.root.addChild(camera);

  const light = new pc.Entity("light");
  light.addComponent("light", {
    type: "directional",
    color: new pc.Color(1, 0.98, 0.92),
    intensity: 1.25,
    castShadows: false,
  });
  light.setEulerAngles(50, -20, 0);
  app.root.addChild(light);

  let destroyed = false;
  /** destroy 시 onload 취소용 — 바닥·유닛 스프라이트 Image */
  const pendingSpriteImgs: HTMLImageElement[] = [];

  /**
   * 정사각 바닥 텍스처를 월드 비율(7×14)에 맞게 반복.
   * 타일 1장 ≈ 월드 3.5단위 → U=2, V=4 (덜 촘촘하게).
   */
  const FLOOR_TILE_WORLD = 3.5;
  const FLOOR_TILES_U = (HALF_W * 2) / FLOOR_TILE_WORLD;
  const FLOOR_TILES_V = (HALF_D * 2) / FLOOR_TILE_WORLD;
  const groundMat = new pc.StandardMaterial();
  groundMat.useLighting = false;
  groundMat.diffuse = new pc.Color(0.22, 0.26, 0.3);
  groundMat.emissive = new pc.Color(0.22, 0.26, 0.3);
  groundMat.emissiveIntensity = 0.35;
  groundMat.cull = pc.CULLFACE_NONE;
  groundMat.update();
  const ground = new pc.Entity("ground");
  ground.addComponent("render", { type: "plane" });
  ground.setLocalScale(HALF_W * 2, 1, HALF_D * 2);
  ground.setPosition(0, GROUND_Y - 0.04, 0);
  const groundMesh = ground.render?.meshInstances?.[0];
  if (groundMesh) groundMesh.material = groundMat;
  app.root.addChild(ground);

  function applyFloorTexture(floorImg: HTMLImageElement): void {
    if (destroyed || !app.graphicsDevice) return;
    const tex = new pc.Texture(app.graphicsDevice, {
      mipmaps: true,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_REPEAT,
      addressV: pc.ADDRESS_REPEAT,
    });
    tex.setSource(floorImg);
    const tiling = new pc.Vec2(FLOOR_TILES_U, FLOOR_TILES_V);
    groundMat.diffuseMap = tex;
    groundMat.emissiveMap = tex;
    groundMat.diffuseMapTiling = tiling;
    groundMat.emissiveMapTiling = tiling;
    groundMat.emissiveIntensity = 0.55;
    groundMat.diffuse = new pc.Color(1, 1, 1);
    groundMat.emissive = new pc.Color(1, 1, 1);
    groundMat.update();
  }

  // 중앙 중립 구역 (건설 불가) — 양 기지 사이 띠
  const neutralBand = createBox(
    "neutralBand",
    HALF_W * 2,
    0.04,
    NEUTRAL_HALF_D * 2,
    new pc.Color(0.22, 0.2, 0.18)
  );
  neutralBand.setPosition(0, GROUND_Y - 0.01, 0);
  app.root.addChild(neutralBand);

  const midLine = createBox(
    "midLine",
    HALF_W * 2,
    0.05,
    0.1,
    new pc.Color(0.45, 0.38, 0.28)
  );
  midLine.setPosition(0, GROUND_Y + 0.02, 0);
  app.root.addChild(midLine);

  // 괴물 크립 — 바닥 위, 안개 아래. 알파는 안개와 같이 경계를 흐린다.
  const creepMask = new pc.Texture(app.graphicsDevice, {
    width: CREEP_TEX_W,
    height: CREEP_TEX_H,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: pc.FILTER_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  });
  const creepMat = new pc.StandardMaterial();
  creepMat.useLighting = false;
  creepMat.diffuse = new pc.Color(0.42, 0.12, 0.48);
  creepMat.emissive = new pc.Color(0.42, 0.12, 0.48);
  creepMat.emissiveIntensity = 0.85;
  creepMat.opacity = 1;
  creepMat.opacityMap = creepMask;
  creepMat.opacityMapChannel = "a";
  creepMat.opacityMapTiling = new pc.Vec2(1, 1);
  creepMat.blendType = pc.BLEND_NORMAL;
  creepMat.depthWrite = false;
  creepMat.depthTest = true;
  creepMat.cull = pc.CULLFACE_NONE;
  creepMat.update();
  const creepPlane = new pc.Entity("creep");
  creepPlane.addComponent("render", { type: "plane" });
  creepPlane.setLocalScale(HALF_W * 2, 1, HALF_D * 2);
  creepPlane.setPosition(0, GROUND_Y + 0.03, 0);
  const creepMesh = creepPlane.render?.meshInstances?.[0];
  if (creepMesh) creepMesh.material = creepMat;
  app.root.addChild(creepPlane);
  let creepPacked = "";

  function applyCreepTexture(img: HTMLImageElement): void {
    if (destroyed || !app.graphicsDevice) return;
    const tex = new pc.Texture(app.graphicsDevice, {
      mipmaps: true,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_REPEAT,
      addressV: pc.ADDRESS_REPEAT,
    });
    tex.setSource(img);
    const tiling = new pc.Vec2(6, 24);
    creepMat.diffuseMap = tex;
    creepMat.emissiveMap = tex;
    creepMat.diffuseMapTiling = tiling;
    creepMat.emissiveMapTiling = tiling;
    creepMat.diffuse = new pc.Color(1, 1, 1);
    creepMat.emissive = new pc.Color(1, 1, 1);
    creepMat.emissiveIntensity = 0.9;
    creepMat.update();
  }

  function uploadCreepTexture(): void {
    if (destroyed || !app.graphicsDevice) return;
    const pixels = creepMask.lock({ mode: pc.TEXTURELOCK_WRITE });
    writeCreepRgba(
      pixels as unknown as Uint8ClampedArray,
      CREEP_TEX_W,
      CREEP_TEX_H,
      creepPacked,
      localSide
    );
    creepMask.unlock();
    creepMat.update();
  }
  uploadCreepTexture();

  // SC1식 전장 안개 — 미탐험 암흑 / 탐험·비시야 반투명 / 시야 투명
  const fogTex = new pc.Texture(app.graphicsDevice, {
    width: GRID_W,
    height: GRID_D,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: pc.FILTER_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  });
  const fogMat = new pc.StandardMaterial();
  fogMat.useLighting = false;
  fogMat.diffuse = new pc.Color(0, 0, 0);
  fogMat.emissive = new pc.Color(0, 0, 0);
  fogMat.emissiveIntensity = 0;
  fogMat.opacity = 1;
  fogMat.opacityMap = fogTex;
  fogMat.opacityMapChannel = "a";
  fogMat.blendType = pc.BLEND_NORMAL;
  fogMat.depthWrite = false;
  fogMat.depthTest = true;
  fogMat.cull = pc.CULLFACE_NONE;
  fogMat.update();
  const fogPlane = new pc.Entity("fog");
  fogPlane.addComponent("render", { type: "plane" });
  fogPlane.setLocalScale(HALF_W * 2, 1, HALF_D * 2);
  fogPlane.setPosition(0, GROUND_Y + 0.15, 0);
  const fogMesh = fogPlane.render?.meshInstances?.[0];
  if (fogMesh) fogMesh.material = fogMat;
  app.root.addChild(fogPlane);

  function uploadFogTexture(): void {
    if (destroyed || !app.graphicsDevice) return;
    const pixels = fogTex.lock({ mode: pc.TEXTURELOCK_WRITE });
    writeFogRgba(pixels as unknown as Uint8ClampedArray, GRID_W, GRID_D);
    fogTex.unlock();
    fogMat.update();
  }

  const ghostPad = createBox(
    "ghost-pad",
    CELL,
    0.06,
    CELL,
    new pc.Color(0.25, 0.85, 0.28),
    0.55
  );
  const ghostCellPads: pc.Entity[] = [];
  /** 스프라이트 없을 때만 쓰는 단색 폴백 */
  const ghostBuildingFallback = createBox(
    "ghost-building-fallback",
    CELL * 0.72,
    0.34,
    CELL * 0.72,
    new pc.Color(0.78, 0.86, 0.74),
    0.55
  );
  let ghostSprite: pc.Entity | null = null;
  let ghostSpriteType: string | null = null;
  ghostPad.enabled = false;
  ghostBuildingFallback.enabled = false;
  app.root.addChild(ghostPad);
  app.root.addChild(ghostBuildingFallback);

  const GHOST_OK = new pc.Color(0.28, 0.86, 0.32);
  /** 유닛·건물 겹침·구역외·비스출구 공통 빨강 */
  const GHOST_BAD = new pc.Color(0.95, 0.16, 0.14);

  function ghostToneColor(tone: GhostPad["tone"]): pc.Color {
    return tone === "ok" ? GHOST_OK : GHOST_BAD;
  }

  function clearGhostCellPads(): void {
    for (let i = 0; i < ghostCellPads.length; i++) {
      ghostCellPads[i].enabled = false;
    }
  }

  function ensureGhostCellPad(i: number): pc.Entity {
    while (ghostCellPads.length <= i) {
      const pad = createBox(
        `ghost-cell-${ghostCellPads.length}`,
        CELL,
        0.05,
        CELL,
        GHOST_OK,
        0.6
      );
      pad.enabled = false;
      app.root.addChild(pad);
      ghostCellPads.push(pad);
    }
    return ghostCellPads[i];
  }

  const powerPads: pc.Entity[] = [];

  function paint(ent: pc.Entity, color: pc.Color): void {
    paintOverlay(ent, color);
  }

  function paintOverlay(ent: pc.Entity, color: pc.Color): void {
    const mesh = ent.render?.meshInstances?.[0];
    if (!mesh) return;
    const mat = mesh.material as pc.StandardMaterial;
    mat.diffuse = color;
    mat.emissive = color;
    mat.emissiveIntensity = 0.85;
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.update();
  }

  function clearGhostSprite(): void {
    if (ghostSprite) {
      ghostSprite.destroy();
      ghostSprite = null;
      ghostSpriteType = null;
    }
  }

  function ensureGhostSprite(typeId: string, w: number, d: number): pc.Entity | null {
    if (ghostSprite && ghostSpriteType === typeId) {
      ghostSprite.setLocalScale(w, 1, d);
      return ghostSprite;
    }
    clearGhostSprite();
    const ent = createSpriteEntity("ghost-building", typeId, w, d);
    if (!ent) return null;
    // 고스트: 반투명 + 깊이 무시 (공유 스프라이트 mat 은 clone 해서 오염 방지)
    const applyGhostMat = (node: pc.Entity) => {
      const mesh = node.render?.meshInstances?.[0];
      if (!mesh?.material) return;
      const mat = (mesh.material as pc.StandardMaterial).clone();
      mat.opacity = 0.62;
      mat.blendType = pc.BLEND_NORMAL;
      mat.depthTest = false;
      mat.depthWrite = false;
      mat.emissiveIntensity = 0.85;
      mat.update();
      mesh.material = mat;
    };
    applyGhostMat(ent);
    for (let i = 0; i < ent.children.length; i++) {
      const child = ent.children[i];
      if (child instanceof pc.Entity) applyGhostMat(child);
    }
    ghostSprite = ent;
    ghostSpriteType = typeId;
    app.root.addChild(ent);
    return ent;
  }

  function setGhost(next: GhostCell | null): void {
    if (!next) {
      ghostPad.enabled = false;
      clearGhostCellPads();
      ghostBuildingFallback.enabled = false;
      clearGhostSprite();
      return;
    }
    const v = toView(next.x, next.z);
    const pads = next.pads;
    if (pads && pads.length > 0) {
      ghostPad.enabled = false;
      for (let i = 0; i < pads.length; i++) {
        const pad = ensureGhostCellPad(i);
        const p = pads[i];
        const pv = toView(p.x, p.z);
        pad.enabled = true;
        // 격자 틈 없이 칸을 붙여 발자국이 하나로 보이게 한다.
        pad.setLocalScale(CELL, 0.05, CELL);
        pad.setPosition(pv.x, GROUND_Y + 0.04, pv.z);
        paint(pad, ghostToneColor(p.tone));
        app.root.addChild(pad);
      }
      for (let i = pads.length; i < ghostCellPads.length; i++) {
        ghostCellPads[i].enabled = false;
      }
    } else {
      clearGhostCellPads();
      ghostPad.enabled = true;
      ghostPad.setLocalScale(next.w, 0.06, next.d);
      ghostPad.setPosition(v.x, GROUND_Y + 0.04, v.z);
      paint(ghostPad, next.valid ? GHOST_OK : GHOST_BAD);
      app.root.addChild(ghostPad);
    }

    const typeId = next.typeId;
    const spriteW = next.w * 1.05;
    const spriteD = next.d * 1.05;
    const sprite =
      typeId && spriteUrl(typeId)
        ? ensureGhostSprite(typeId, spriteW, spriteD)
        : null;
    if (sprite) {
      ghostBuildingFallback.enabled = false;
      sprite.enabled = true;
      sprite.setPosition(v.x, GROUND_Y + 0.12, v.z);
      sprite.setLocalEulerAngles(0, 0, 0);
      app.root.addChild(sprite);
    } else {
      clearGhostSprite();
      ghostBuildingFallback.enabled = true;
      ghostBuildingFallback.setLocalScale(next.w * 0.85, 0.28, next.d * 0.85);
      ghostBuildingFallback.setPosition(v.x, GROUND_Y + 0.18, v.z);
      paint(
        ghostBuildingFallback,
        next.valid
          ? new pc.Color(0.75, 0.92, 0.7)
          : new pc.Color(0.85, 0.45, 0.4)
      );
      app.root.addChild(ghostBuildingFallback);
    }
  }

  function setPowerFields(rects: PowerRect[]): void {
    while (powerPads.length < rects.length) {
      const pad = createBox(
        `power-${powerPads.length}`,
        CELL,
        0.03,
        CELL,
        new pc.Color(0.35, 0.55, 0.95),
        0.28
      );
      pad.enabled = false;
      app.root.addChild(pad);
      powerPads.push(pad);
    }
    for (let i = 0; i < powerPads.length; i++) {
      const pad = powerPads[i];
      const rect = rects[i];
      if (!rect) {
        pad.enabled = false;
        continue;
      }
      pad.enabled = true;
      const v = toView(rect.x, rect.z);
      pad.setLocalScale(rect.w, 0.03, rect.d);
      pad.setPosition(v.x, GROUND_Y + 0.025, v.z);
      paintOverlay(pad, new pc.Color(0.32, 0.55, 0.98));
      app.root.addChild(pad);
    }
  }

  const entityMap = new Map<string, pc.Entity>();
  /** 아군 시야 제공자의 안개 칸. 칸이 바뀔 때만 안개를 다시 칠한다. */
  const fogCell = new Map<string, number>();
  let prevSnapAt = 0;
  /** 스냅샷 적용 중에만 선택·경로를 루트 맨 뒤로 올린다. */
  let overlayReorder = false;
  const spriteMats = new Map<string, pc.StandardMaterial>();
  let lastEntities: EntitySnap[] = [];
  /** 스프라이트 상단(로컬 +Z)이 전방. 이동·조준 방향과 맞춘다. */
  /** 서버 좌표 → 화면 좌표 보간. 유닛·일꾼·유충. */
  const motions = new Map<
    string,
    {
      fromX: number;
      fromZ: number;
      toX: number;
      toZ: number;
      y: number;
      yaw: number;
      yawOffset: number;
      /** 공격 대상 월드 좌표. 있으면 이동 방향보다 우선한다. */
      aimX: number | null;
      aimZ: number | null;
      startedAt: number;
      duration: number;
    }
  >();
  const spriteEntityIds = new Set<string>();
  /** 엔티티 typeId 변경(유충→알) 시 스프라이트 재생성용 */
  const entityTypeIds = new Map<string, string>();
  const entityKinds = new Map<string, EntitySnap["kind"]>();
  /** 유닛 파괴 스프라이트. 2프레임을 이 간격으로 바꾼 뒤 지운다. */
  const DIE_FRAME_SEC = 0.16;
  /** 이동 보행 프레임 간격(초). idle↔move 토글. */
  const MOVE_FRAME_SEC = 0.16;
  /** 폭발 한 변 = 유닛 스프라이트 긴 변 × 이 배율. 텍스처 여백을 감안한다. */
  const DIE_BURST_SCALE = 2.5;
  type DieBurst = {
    root: pc.Entity;
    mats: pc.StandardMaterial[];
    startedAt: number;
    frame: number;
  };
  const dieBursts: DieBurst[] = [];
  /** 피격 표식. 보이는 한 변은 때린 유닛 스프라이트 크기. */
  const HIT_LIFE = 0.22;
  type HitFlash = {
    root: pc.Entity;
    mat: pc.StandardMaterial;
    startedAt: number;
  };
  const hitFlashes: HitFlash[] = [];
  /** 피격 피해 숫자. 맞은 자리에 떠올랐다가 사라진다. */
  const DMG_POP_LIFE = 0.72;
  const DMG_POP_RISE = 32;
  type DmgPop = {
    el: HTMLSpanElement;
    x: number;
    z: number;
    ox: number;
    lift: number;
    startedAt: number;
  };
  const dmgPops: DmgPop[] = [];
  const dmgLayer = document.createElement("div");
  dmgLayer.className = "dmg-pop-layer";
  canvas.parentElement?.appendChild(dmgLayer);
  /** 건물 피해 파티클. 체력이 낮을수록 많고, 페이드가 빠르다. */
  const DMG_MAX = 8;
  type DmgParticle = {
    root: pc.Entity;
    mat: pc.StandardMaterial;
    fxType: string;
    born: number;
    ox: number;
    oz: number;
    scale: number;
    gen: number;
  };
  const dmgParticles = new Map<string, DmgParticle[]>();
  /** 이동 애니메이션 시작 시각. 정지 시 삭제. */
  const walkStarted = new Map<string, number>();
  /** 타격 순간부터 공격 자세를 유지하는 시각. */
  const ATTACK_POSE_SEC = 0.2;
  const attackPoseUntil = new Map<string, number>();
  /** 엔티티에 마지막으로 적용한 스프라이트 typeId (불필요 스왑 방지) */
  const walkApplied = new Map<string, string>();
  const CARGO_SIZE = 0.28;
  /** 유닛 로컬 +Z = 전방(스프라이트 상단). 운반 미네랄을 앞에 붙인다. */
  const CARGO_FORWARD = 0.36;

  /** 탑뷰 스프라이트: 이미지 상단이 전방. 뷰 공간 이동 방향으로 Yaw(+Z). */
  function yawFromDelta(dx: number, dz: number): number | null {
    if (dx * dx + dz * dz < 1e-8) return null;
    const v = toView(dx, dz);
    return (Math.atan2(v.x, v.z) * 180) / Math.PI;
  }

  /** 기동포·관측체는 이동·조준과 상관없이 스프라이트 기본 방향을 유지한다. */
  function locksFacing(typeId: string | undefined): boolean {
    return typeId === "alien_dragoon" || typeId === "monster_sac";
  }

  function syncMineralCargo(ent: pc.Entity, e: EntitySnap): void {
    const carrying = e.kind === "worker" && (e.carry || 0) > 0;
    let cargo: pc.Entity | null = null;
    for (let i = 0; i < ent.children.length; i++) {
      const child = ent.children[i];
      if (child instanceof pc.Entity && child.name === "mineral-cargo") {
        cargo = child;
        break;
      }
    }
    if (!carrying) {
      if (cargo) cargo.enabled = false;
      return;
    }
    // 부모가 foot 스케일이라 자식 위치·크기를 보정해 월드에서 일정한 앞에 보이게 한다.
    const foot = spriteFoot(e);
    const sx = Math.max(foot.w, 1e-4);
    const sz = Math.max(foot.d, 1e-4);
    if (!cargo) {
      cargo = createSpriteEntity(`${e.id}-cargo`, "mineral_cargo", 1, 1);
      if (!cargo) return;
      cargo.name = "mineral-cargo";
      ent.addChild(cargo);
    }
    cargo.enabled = true;
    cargo.setLocalScale(CARGO_SIZE / sx, 1, CARGO_SIZE / sz);
    cargo.setLocalPosition(0, 0.05, CARGO_FORWARD / sz);
  }

  function syncGhostSpriteMaps(typeId: string): void {
    if (!ghostSprite || ghostSpriteType !== typeId) return;
    const shared = spriteMats.get(typeId);
    if (!shared?.diffuseMap) return;
    const apply = (node: pc.Entity) => {
      const mesh = node.render?.meshInstances?.[0];
      if (!mesh?.material) return;
      const mat = mesh.material as pc.StandardMaterial;
      mat.diffuseMap = shared.diffuseMap;
      mat.emissiveMap = shared.emissiveMap;
      mat.opacityMap = shared.opacityMap;
      mat.opacityMapChannel = "a";
      mat.opacity = 0.62;
      mat.blendType = pc.BLEND_NORMAL;
      mat.depthTest = false;
      mat.depthWrite = false;
      mat.update();
    };
    apply(ghostSprite);
    for (let i = 0; i < ghostSprite.children.length; i++) {
      const child = ghostSprite.children[i];
      if (child instanceof pc.Entity) apply(child);
    }
  }

  function bindSpriteTexture(
    mat: pc.StandardMaterial,
    img: HTMLImageElement,
    typeId: string
  ): void {
    if (destroyed || !app.graphicsDevice) return;
    if (!img.complete || img.naturalWidth <= 0) return;
    const tex = new pc.Texture(app.graphicsDevice, {
      mipmaps: true,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    tex.setSource(img);
    mat.diffuseMap = tex;
    mat.emissiveMap = tex;
    mat.opacityMap = tex;
    mat.opacityMapChannel = "a";
    mat.opacity = 1;
    mat.update();
    syncGhostSpriteMaps(typeId);
  }

  function materialForSprite(typeId: string): pc.StandardMaterial | null {
    const url = spriteUrl(typeId);
    if (!url) return null;
    let mat = spriteMats.get(typeId);
    if (mat) return mat;
    mat = new pc.StandardMaterial();
    mat.useLighting = false;
    mat.blendType = pc.BLEND_NORMAL;
    // 텍스처 전에는 완전 투명 — 흰 사각 깜빡임 방지
    mat.opacity = 0;
    mat.cull = pc.CULLFACE_NONE;
    mat.depthWrite = false;
    mat.diffuse = new pc.Color(1, 1, 1);
    mat.emissive = new pc.Color(1, 1, 1);
    mat.emissiveIntensity = 1;
    mat.update();
    spriteMats.set(typeId, mat);

    const cached = getCachedImage(url);
    if (cached) {
      bindSpriteTexture(mat, cached, typeId);
      return mat;
    }
    const img = new Image();
    pendingSpriteImgs.push(img);
    img.onload = () => bindSpriteTexture(mat, img, typeId);
    img.onerror = () => {
      /* ignore */
    };
    img.src = url;
    return mat;
  }

  const assetsReady = preloadBattleAssets().then(() => {
    if (destroyed) return;
    const floor = getCachedImage(FLOOR_MAP_URL);
    if (floor) applyFloorTexture(floor);
    const creepImg = getCachedImage(CREEP_URL);
    if (creepImg) applyCreepTexture(creepImg);
    for (const typeId in SPRITE_URL) {
      if (Object.prototype.hasOwnProperty.call(SPRITE_URL, typeId)) {
        materialForSprite(typeId);
      }
    }
  });

  function createSpriteEntity(
    name: string,
    typeId: string,
    w: number,
    d: number
  ): pc.Entity | null {
    const mat = materialForSprite(typeId);
    if (!mat) return null;
    const ent = new pc.Entity(name);
    ent.addComponent("render", { type: "plane" });
    // PlayCanvas plane 은 +Y 를 바라보는 XZ 평면.
    ent.setLocalScale(w, 1, d);
    const mesh = ent.render?.meshInstances?.[0];
    if (mesh) mesh.material = mat;
    return ent;
  }

  function spawnDieBurst(typeId: string, pos: pc.Vec3, unitSpan: number): void {
    const frames = dieFxFrames(typeId);
    if (!frames) return;
    const mat0 = materialForSprite(frames[0]);
    const mat1 = materialForSprite(frames[1]);
    if (!mat0 || !mat1) return;
    const size = Math.max(unitSpan, 0.2) * DIE_BURST_SCALE;
    const root = createSpriteEntity("die-burst", frames[0], size, size);
    if (!root) return;
    root.setPosition(pos.x, ACTOR_Y + 0.35, pos.z);
    app.root.addChild(root);
    dieBursts.push({
      root,
      mats: [mat0, mat1],
      startedAt: performance.now() / 1000,
      frame: 0,
    });
  }

  function spawnHitFlashes(hits: HitSnap[] | undefined): void {
    if (!hits) return;
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      const fx = hitFx(hit.attackerTypeId);
      if (!fx || fx.fill <= 0) continue;
      const v = toView(hit.x, hit.z);
      if (!isFogVisibleAtView(v.x, v.z)) continue;
      const base = materialForSprite(fx.frame);
      if (!base) continue;
      const mat = base.clone() as pc.StandardMaterial;
      mat.opacity = 1;
      mat.update();
      const size = attackerSpan(hit.attackerTypeId) / fx.fill;
      const root = new pc.Entity("hit-flash");
      root.addComponent("render", { type: "plane" });
      root.setLocalScale(size, 1, size);
      const mesh = root.render?.meshInstances?.[0];
      if (mesh) mesh.material = mat;
      root.setPosition(v.x, hit.lift ? ACTOR_Y + 0.35 : GROUND_Y + 0.3, v.z);
      app.root.addChild(root);
      hitFlashes.push({
        root,
        mat,
        startedAt: performance.now() / 1000,
      });
    }
  }

  function spawnDamagePops(hits: HitSnap[] | undefined): void {
    if (!hits || !dmgLayer.isConnected) return;
    const stack = new Map<string, number>();
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      if (!(hit.damage > 0)) continue;
      const v = toView(hit.x, hit.z);
      if (!isFogVisibleAtView(v.x, v.z)) continue;
      const key = `${Math.round(hit.x * 20)},${Math.round(hit.z * 20)}`;
      const n = stack.get(key) ?? 0;
      stack.set(key, n + 1);
      const el = document.createElement("span");
      el.className = hit.side === localSide ? "dmg-pop is-ally" : "dmg-pop";
      el.textContent = String(Math.round(hit.damage));
      dmgLayer.appendChild(el);
      dmgPops.push({
        el,
        x: hit.x,
        z: hit.z,
        ox: (n % 3 - 1) * 14,
        lift: hit.lift ? 16 : 8,
        startedAt: performance.now() / 1000,
      });
    }
  }

  function tickDamagePops(now: number): void {
    for (let i = dmgPops.length - 1; i >= 0; i--) {
      const pop = dmgPops[i];
      const t = (now - pop.startedAt) / DMG_POP_LIFE;
      if (t >= 1) {
        pop.el.remove();
        dmgPops.splice(i, 1);
        continue;
      }
      const scr = worldToScreenPercent(
        pop.x,
        pop.z,
        localSide,
        camAspect,
        camViewX,
        camViewZ
      );
      const rise = pop.lift + t * DMG_POP_RISE;
      const fade = t > 0.62 ? Math.max(0, 1 - (t - 0.62) / 0.38) : 1;
      const scale = t < 0.12 ? 0.72 + (t / 0.12) * 0.38 : 1;
      pop.el.style.left = `${scr.left}%`;
      pop.el.style.top = `${scr.top}%`;
      pop.el.style.opacity = String(fade);
      pop.el.style.transform = `translate(calc(-50% + ${pop.ox}px), calc(-100% - ${rise}px)) scale(${scale})`;
    }
  }

  function tickHitFlashes(now: number): void {
    for (let i = hitFlashes.length - 1; i >= 0; i--) {
      const fx = hitFlashes[i];
      const t = (now - fx.startedAt) / HIT_LIFE;
      if (t >= 1) {
        fx.root.destroy();
        if (typeof fx.mat.destroy === "function") fx.mat.destroy();
        hitFlashes.splice(i, 1);
        continue;
      }
      fx.mat.opacity = 1 - t;
      fx.mat.update();
    }
  }

  function hash01(n: number): number {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function dmgPulse(t: number): number {
    if (t < 0.22) return t / 0.22;
    if (t > 0.62) return Math.max(0, 1 - (t - 0.62) / 0.38);
    return 1;
  }

  function dmgCountAndLife(ratio: number): { count: number; life: number; peak: number } {
    const missing = 1 - Math.max(0, Math.min(1, ratio));
    if (missing < 0.04) return { count: 0, life: 1.6, peak: 0 };
    const count = Math.min(DMG_MAX, Math.max(1, Math.ceil(missing * DMG_MAX)));
    const life = 1.75 - missing * 1.25;
    const peak = 0.5 + missing * 0.45;
    return { count, life, peak };
  }

  function destroyDmgList(list: DmgParticle[]): void {
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.root.destroy();
      if (typeof p.mat.destroy === "function") p.mat.destroy();
    }
  }

  function rollDmgParticle(
    p: DmgParticle,
    foot: { w: number; d: number },
    now: number,
    life: number
  ): void {
    p.gen += 1;
    const a = hash01(p.gen * 19.1 + p.ox * 3);
    const b = hash01(p.gen * 7.3 + 4.2);
    p.ox = (a - 0.5) * foot.w * 0.62;
    p.oz = (b - 0.5) * foot.d * 0.62;
    const span = Math.min(foot.w, foot.d);
    p.scale = span * (0.42 + hash01(p.gen * 3.1) * 0.22);
    p.born = now - life * hash01(p.gen * 5.5);
    p.root.setLocalScale(p.scale, 1, p.scale);
  }

  function makeDmgParticle(fxType: string, now: number, life: number, foot: { w: number; d: number }): DmgParticle | null {
    const base = materialForSprite(fxType);
    if (!base) return null;
    const mat = base.clone() as pc.StandardMaterial;
    mat.blendType = pc.BLEND_NORMAL;
    mat.depthWrite = false;
    mat.cull = pc.CULLFACE_NONE;
    mat.opacity = 0;
    mat.update();
    const root = new pc.Entity("bldg-dmg");
    root.addComponent("render", { type: "plane" });
    const mesh = root.render?.meshInstances?.[0];
    if (mesh) mesh.material = mat;
    root.setLocalEulerAngles(0, 0, 0);
    app.root.addChild(root);
    const p: DmgParticle = {
      root,
      mat,
      fxType,
      born: now,
      ox: 0,
      oz: 0,
      scale: 0.3,
      gen: Math.floor(hash01(now * 1000 + dmgParticles.size) * 1000),
    };
    rollDmgParticle(p, foot, now, life);
    return p;
  }

  function adoptDmgTexture(p: DmgParticle): void {
    if (p.mat.diffuseMap) return;
    const base = spriteMats.get(p.fxType);
    if (!base?.diffuseMap) return;
    p.mat.diffuseMap = base.diffuseMap;
    p.mat.emissiveMap = base.emissiveMap;
    p.mat.opacityMap = base.opacityMap;
    p.mat.opacityMapChannel = "a";
  }

  function tickBuildingDamage(now: number): void {
    const alive = new Set<string>();
    for (let i = 0; i < lastEntities.length; i++) {
      const e = lastEntities[i];
      if (e.kind !== "building" && e.kind !== "hq") continue;
      const fxType = buildingDamageFx(e.typeId);
      if (!fxType || e.constructing || e.maxHp <= 0) continue;
      const ent = entityMap.get(e.id);
      const visible = !!ent && ent.enabled && fogRevealsEntity(e, localSide);
      const spec = dmgCountAndLife(e.hp / e.maxHp);
      if (!visible || spec.count === 0) {
        const stale = dmgParticles.get(e.id);
        if (stale) {
          destroyDmgList(stale);
          dmgParticles.delete(e.id);
        }
        continue;
      }
      alive.add(e.id);
      let list = dmgParticles.get(e.id);
      if (!list) {
        list = [];
        dmgParticles.set(e.id, list);
      }
      if (list.length && list[0].fxType !== fxType) {
        destroyDmgList(list);
        list = [];
        dmgParticles.set(e.id, list);
      }
      const foot = spriteFoot(e);
      while (list.length < spec.count) {
        const p = makeDmgParticle(fxType, now, spec.life, foot);
        if (!p) break;
        list.push(p);
      }
      while (list.length > spec.count) {
        const dropped = list.pop();
        if (dropped) destroyDmgList([dropped]);
      }
      const pos = ent.getPosition();
      for (let n = 0; n < list.length; n++) {
        const p = list[n];
        let age = now - p.born;
        if (age >= spec.life) {
          rollDmgParticle(p, foot, now, spec.life);
          age = now - p.born;
        }
        const t = Math.max(0, Math.min(1, age / spec.life));
        adoptDmgTexture(p);
        p.mat.opacity = dmgPulse(t) * Math.min(0.75, spec.peak);
        p.mat.update();
        p.root.setPosition(pos.x + p.ox, GROUND_Y + 0.24 + n * 0.012, pos.z + p.oz);
      }
    }
    dmgParticles.forEach((list, id) => {
      if (alive.has(id)) return;
      destroyDmgList(list);
      dmgParticles.delete(id);
    });
  }

  function tickDieBursts(now: number): void {
    for (let i = dieBursts.length - 1; i >= 0; i--) {
      const fx = dieBursts[i];
      const frame = Math.floor((now - fx.startedAt) / DIE_FRAME_SEC);
      if (frame >= fx.mats.length) {
        fx.root.destroy();
        dieBursts.splice(i, 1);
        continue;
      }
      if (frame !== fx.frame) {
        fx.frame = frame;
        const mesh = fx.root.render?.meshInstances?.[0];
        if (mesh) mesh.material = fx.mats[frame];
      }
    }
  }

  function noteAttackPoses(hits: HitSnap[] | undefined, now: number): void {
    if (!hits) return;
    const claimed = new Set<string>();
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      if (hit.attackerId && claimed.has(hit.attackerId)) continue;
      let id = hit.attackerId;
      if (!id) {
        let best = "";
        let bestD = Infinity;
        for (let n = 0; n < lastEntities.length; n++) {
          const e = lastEntities[n];
          if (claimed.has(e.id) || e.typeId !== hit.attackerTypeId) continue;
          if (e.order !== "attack" && e.order !== "attack_move") continue;
          if (!attackSprite(e.typeId)) continue;
          const d = (e.x - hit.x) * (e.x - hit.x) + (e.z - hit.z) * (e.z - hit.z);
          if (d < bestD) {
            bestD = d;
            best = e.id;
          }
        }
        id = best;
      }
      if (!id || claimed.has(id)) continue;
      const attacker = lastEntities.find((e) => e.id === id);
      if (!attacker || !attackSprite(attacker.typeId)) continue;
      claimed.add(id);
      attackPoseUntil.set(id, now + ATTACK_POSE_SEC);
    }
  }

  function bodyIsMoving(e: EntitySnap): boolean {
    const m = motions.get(e.id);
    if (!m) return false;
    const dx = m.toX - m.fromX;
    const dz = m.toZ - m.fromZ;
    return dx * dx + dz * dz > 1e-4;
  }

  function entityIsMoving(e: EntitySnap): boolean {
    // 채취·건설 중에는 idle 유지. 이동 애니메이션은 실제 이동만.
    if (e.order === "move" || e.order === "attack_move") return true;
    return bodyIsMoving(e);
  }

  /** 기동포 공격은 다리 벌린 정지 스프라이트. 걸어가는 공격이동만 이동 프레임. */
  function dragoonAttackIdle(e: EntitySnap): boolean {
    if (e.typeId !== "alien_dragoon") return false;
    if (e.order === "attack") return true;
    if (e.order !== "attack_move") return false;
    return !bodyIsMoving(e);
  }

  function applyWalkSprite(ent: pc.Entity, id: string, typeId: string): void {
    if (walkApplied.get(id) === typeId) return;
    const mat = materialForSprite(typeId);
    if (!mat) return;
    const mesh = ent.render?.meshInstances?.[0];
    if (!mesh) return;
    mesh.material = mat;
    walkApplied.set(id, typeId);
  }

  function tickWalkAnims(now: number): void {
    for (let i = 0; i < lastEntities.length; i++) {
      const e = lastEntities[i];
      if (!spriteEntityIds.has(e.id)) continue;
      const ent = entityMap.get(e.id);
      if (!ent) continue;
      if (
        e.constructing &&
        (e.kind === "building" || e.kind === "hq") &&
        e.typeId.indexOf("alien_") === 0
      ) {
        applyWalkSprite(ent, e.id, "alien_warp");
        continue;
      }
      if (
        (e.kind === "building" || e.kind === "hq") &&
        e.typeId.indexOf("alien_") === 0 &&
        walkApplied.get(e.id) === "alien_warp"
      ) {
        applyWalkSprite(ent, e.id, e.typeId);
      }
      if (dragoonAttackIdle(e)) {
        walkStarted.delete(e.id);
        applyWalkSprite(ent, e.id, e.typeId);
        continue;
      }
      const frames = walkFrames(e.typeId);
      const atk = attackSprite(e.typeId);
      const poseUntil = attackPoseUntil.get(e.id);
      if (atk && poseUntil != null && now < poseUntil) {
        applyWalkSprite(ent, e.id, atk);
        continue;
      }
      if (poseUntil != null) attackPoseUntil.delete(e.id);
      if (!frames) continue;
      const moving = entityIsMoving(e);
      if (!moving) {
        walkStarted.delete(e.id);
        // 정지: 기존 필드 스프라이트(idle)
        applyWalkSprite(ent, e.id, e.typeId);
        continue;
      }
      let started = walkStarted.get(e.id);
      if (started == null) {
        started = now;
        walkStarted.set(e.id, started);
      }
      // 이동: frame1(_move) ↔ frame2(_move2)
      const frame = Math.floor((now - started) / MOVE_FRAME_SEC) % 2;
      applyWalkSprite(ent, e.id, frames[frame]);
    }
  }

  const onUpdate = (dt: number) => {
    const step = Math.min(dt, 0.05);
    const now = performance.now() / 1000;
    motions.forEach((m, id) => {
      const ent = entityMap.get(id);
      if (!ent) return;
      const u = Math.min(1, (now - m.startedAt) / Math.max(m.duration, 1e-4));
      // smoothstep
      const a = u * u * (3 - 2 * u);
      const x = m.fromX + (m.toX - m.fromX) * a;
      const z = m.fromZ + (m.toZ - m.fromZ) * a;
      const v = toView(x, z);
      ent.setPosition(v.x, m.y, v.z);
      if (locksFacing(entityTypeIds.get(id))) {
        m.yaw = 0;
      } else {
        const look =
          m.aimX != null && m.aimZ != null
            ? yawFromDelta(m.aimX - x, m.aimZ - z)
            : yawFromDelta(m.toX - m.fromX, m.toZ - m.fromZ);
        if (look != null) m.yaw = look + m.yawOffset;
      }
      if (spriteEntityIds.has(id)) ent.setLocalEulerAngles(0, m.yaw, 0);
      if (u >= 1) {
        m.fromX = m.toX;
        m.fromZ = m.toZ;
      }
    });
    if (selectedIds.length) updateSelectionVisual();
    tickWalkAnims(now);
    tickDieBursts(now);
    tickHitFlashes(now);
    tickDamagePops(now);
    tickBuildingDamage(now);
    tickMarkerAnims(step);
    // 랠리 점선: UV 오프셋만 갱신 (드로우콜 1, CPU 부담 최소)
    if (rallyRoot.enabled && rallyLineMat) {
      rallyScroll = (rallyScroll + step * RALLY_SCROLL_SPEED) % 1;
      scrollDashMat(rallyLineMat, rallyScroll);
    }
  };
  app.on("update", onUpdate);
  let selectedIds: string[] = [];

  /**
   * select_bracket.png(512)에서 ㄱ자 불투명 바깥 가장자리 비율.
   * 평면 스케일 = 맞출 크기 / 이 값 → 테두리 바깥이 그 사각형에 맞는다.
   * 유닛은 스프라이트 크기, 건물·자원은 칸 점유.
   */
  const BRACKET_OUTER_W = 456 / 512;
  const BRACKET_OUTER_D = 453 / 512;
  /**
   * 아군 유닛은 초록 고정. 체력색은 적 선택(빨강)과 겹친다.
   * 건물은 HP 비율(초록>66% → 노랑>33% → 빨강). 적·중립은 고정색.
   */
  const hpGreen = new pc.Color(0.49, 1, 0.29);
  const hpYellow = new pc.Color(0.98, 0.88, 0.2);
  const hpRed = new pc.Color(0.95, 0.28, 0.22);
  const neutralBracket = new pc.Color(0.98, 0.92, 0.35);
  const enemyBracket = hpRed;
  type BracketSet = {
    root: pc.Entity;
    plane: pc.Entity;
    mat: pc.StandardMaterial;
    tone: pc.Color | null;
  };
  const bracketPool: BracketSet[] = [];
  let bracketTex: pc.Texture | null = null;

  function applyBracketTexture(mat: pc.StandardMaterial): void {
    if (!bracketTex) return;
    mat.diffuseMap = bracketTex;
    mat.emissiveMap = bracketTex;
    mat.opacityMap = bracketTex;
    mat.opacityMapChannel = "a";
    mat.opacity = 1;
    mat.update();
  }

  function allocBracket(index: number): BracketSet {
    const root = new pc.Entity(`selection-${index}`);
    const mat = new pc.StandardMaterial();
    mat.useLighting = false;
    mat.blendType = pc.BLEND_NORMAL;
    mat.cull = pc.CULLFACE_NONE;
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.diffuse = hpGreen;
    mat.emissive = hpGreen;
    mat.emissiveIntensity = 1;
    mat.opacity = 0;
    mat.update();
    applyBracketTexture(mat);
    const plane = new pc.Entity(`sel-plane-${index}`);
    plane.addComponent("render", { type: "plane" });
    const mesh = plane.render?.meshInstances?.[0];
    if (mesh) mesh.material = mat;
    root.addChild(plane);
    root.enabled = false;
    app.root.addChild(root);
    return { root, plane, mat, tone: null };
  }

  function ensureBrackets(count: number): void {
    while (bracketPool.length < count) {
      bracketPool.push(allocBracket(bracketPool.length));
    }
  }

  const rallyRoot = new pc.Entity("rally");
  const rallyMarker = createTargetMarker(
    app,
    "rally-dot",
    "rally_dot",
    RALLY_MARKER_SIZE,
    {
      trackImage: (img) => pendingSpriteImgs.push(img),
      alive: () => !destroyed && !!app.graphicsDevice,
    }
  );
  rallyRoot.addChild(rallyMarker.root);

  /** 점선 1장 + UV 스크롤 — 박스 N개보다 드로우콜·트랜스폼 갱신이 훨씬 적다. */
  const { entity: rallyLine, material: rallyLineMat } = createDashLine(
    app,
    "rally-line",
    "rgba(255, 230, 64, 1)"
  );
  let rallyScroll = 0;
  let markerAnimT = 0;
  rallyRoot.addChild(rallyLine);
  rallyRoot.enabled = false;
  app.root.addChild(rallyRoot);

  function tickMarkerAnims(dt: number): void {
    markerAnimT += dt;
    if (!rallyRoot.enabled) return;
    const pulse = 1 + Math.sin(markerAnimT * MARKER_PULSE_SPEED) * 0.07;
    const spin = (markerAnimT * MARKER_SPIN_DEG) % 360;
    animateTargetMarker(rallyMarker, pulse, spin, -spin * 0.65);
  }

  function toView(x: number, z: number): { x: number; z: number } {
    return toViewCoords(x, z, localSide);
  }

  function loadBracketTexture(): void {
    const url = SPRITE_URL.select_bracket;
    const apply = (img: HTMLImageElement) => {
      if (destroyed || !app.graphicsDevice) return;
      if (!img.complete || img.naturalWidth <= 0) return;
      const tex = new pc.Texture(app.graphicsDevice, {
        mipmaps: true,
        minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      });
      tex.setSource(img);
      bracketTex = tex;
      for (let i = 0; i < bracketPool.length; i++) {
        applyBracketTexture(bracketPool[i].mat);
      }
    };
    const cached = getCachedImage(url);
    if (cached) {
      apply(cached);
      return;
    }
    const img = new Image();
    pendingSpriteImgs.push(img);
    img.onload = () => apply(img);
    img.src = url;
  }
  loadBracketTexture();

  function bracketColorFor(target: EntitySnap): pc.Color {
    const neutral = target.kind === "mineral" || target.kind === "gas";
    if (neutral) return neutralBracket;
    const mine = localSide == null ? target.side === "bottom" : target.side === localSide;
    if (!mine) return enemyBracket;
    const actor =
      target.kind === "unit" ||
      target.kind === "worker" ||
      target.kind === "larva" ||
      target.kind === "egg";
    if (actor) return hpGreen;
    const max = Math.max(target.maxHp, 1);
    const ratio = Math.max(0, Math.min(1, target.hp / max));
    if (ratio > 0.66) return hpGreen;
    if (ratio > 0.33) return hpYellow;
    return hpRed;
  }

  function placeBracketOn(target: EntitySnap, set: BracketSet): void {
    const color = bracketColorFor(target);
    if (set.tone !== color) {
      set.tone = color;
      set.mat.diffuse = color;
      set.mat.emissive = color;
      set.mat.update();
    }
    const actor =
      target.kind === "unit" ||
      target.kind === "worker" ||
      target.kind === "larva" ||
      target.kind === "egg";
    const foot = actor ? groundFoot(target) : gridFoot(target);
    const live = entityMap.get(target.id);
    const v = live
      ? { x: live.getPosition().x, z: live.getPosition().z }
      : toView(target.x, target.z);
    const y = actor ? ACTOR_Y + 0.08 : GROUND_Y + 0.22;
    set.plane.setLocalScale(
      foot.w / BRACKET_OUTER_W,
      1,
      foot.d / BRACKET_OUTER_D
    );
    set.root.setPosition(v.x, y, v.z);
    set.root.enabled = true;
    if (overlayReorder || !set.root.parent) app.root.addChild(set.root);
  }

  function updateSelectionVisual(): void {
    const targets: EntitySnap[] = [];
    for (let i = 0; i < selectedIds.length; i++) {
      const id = selectedIds[i];
      for (let j = 0; j < lastEntities.length; j++) {
        if (lastEntities[j].id === id && !lastEntities[j].inside) {
          targets.push(lastEntities[j]);
          break;
        }
      }
    }
    ensureBrackets(targets.length);
    for (let i = 0; i < bracketPool.length; i++) {
      bracketPool[i].root.enabled = false;
    }
    for (let i = 0; i < targets.length; i++) {
      placeBracketOn(targets[i], bracketPool[i]);
    }
    const primary = targets[0] ?? null;
    if (!primary) {
      updateRallyVisual(null);
      return;
    }
    const neutral = primary.kind === "mineral" || primary.kind === "gas";
    const mine =
      localSide == null ? primary.side === "bottom" : primary.side === localSide;
    updateRallyVisual(mine && !neutral ? primary : null);
  }

  function updateRallyVisual(target: EntitySnap | null): void {
    const rx = target != null ? Number(target.rallyX) : NaN;
    const rz = target != null ? Number(target.rallyZ) : NaN;
    // null/undefined → Number 이 0 이 되어 맵 중앙(화면 중앙)에 찍히는 걸 막는다.
    const hasRally =
      target != null &&
      typeof target.rallyX === "number" &&
      typeof target.rallyZ === "number" &&
      Number.isFinite(target.rallyX) &&
      Number.isFinite(target.rallyZ);
    const canShow =
      hasRally &&
      (target.kind === "building" || target.kind === "hq");
    if (!canShow || !target) {
      rallyRoot.enabled = false;
      return;
    }
    // 건물 중앙 → 랠리 마커
    const from = toView(target.x, target.z);
    const to = toView(rx, rz);
    const y = RALLY_Y;
    rallyMarker.root.setPosition(to.x, y, to.z);
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    const angle = (Math.atan2(dx, dz) * 180) / Math.PI;
    if (len < 0.25) {
      rallyLine.enabled = false;
    } else {
      rallyLine.enabled = true;
      rallyLine.setPosition((from.x + to.x) * 0.5, y, (from.z + to.z) * 0.5);
      // plane +Z 가 선 방향. 두께=X, 길이=Z
      rallyLine.setLocalEulerAngles(0, angle, 0);
      rallyLine.setLocalScale(RALLY_LINE_WIDTH, 1, len);
      const tiles = Math.max(1, len / RALLY_DASH_PERIOD);
      const tiling = new pc.Vec2(1, tiles);
      rallyLineMat.diffuseMapTiling = tiling;
      rallyLineMat.emissiveMapTiling = tiling;
      rallyLineMat.opacityMapTiling = tiling;
      rallyLineMat.update();
    }
    rallyRoot.enabled = true;
    // 스프라이트보다 나중에 그려지도록 루트 재첨부
    app.root.addChild(rallyRoot);
  }

  function canvasAspect(): number {
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 9;
    const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 16;
    return w / Math.max(h, 1);
  }

  function applyCameraPose(): void {
    const clamped = clampCameraView(camViewX, camViewZ, camAspect);
    camViewX = clamped.x;
    camViewZ = clamped.z;
    camera.setPosition(camViewX, 20, camViewZ);
    camera.setEulerAngles(-90, 0, 0);
    if (camera.camera) {
      camera.camera.projection = pc.PROJECTION_ORTHOGRAPHIC;
      camera.camera.orthoHeight = viewOrthoHeight(camAspect);
    }
  }

  function updateCameraRig(): void {
    const prevOrtho = viewOrthoHeight(camAspect);
    const homeZ = homeCameraView(camAspect).z;
    const atHome = Math.abs(camViewZ - homeZ) < 0.08;
    // 리사이즈 전 뷰포트 하단 월드 Z — 종횡비가 바뀌어도 하단 기준을 유지
    const bottomEdge = camViewZ + prevOrtho;
    camAspect = canvasAspect();
    if (atHome) {
      const home = homeCameraView(camAspect);
      camViewX = home.x;
      camViewZ = home.z;
    } else {
      camViewZ = bottomEdge - viewOrthoHeight(camAspect);
    }
    applyCameraPose();
    ground.setLocalScale(HALF_W * 2, 1, HALF_D * 2);
    const tiling = new pc.Vec2(FLOOR_TILES_U, FLOOR_TILES_V);
    groundMat.diffuseMapTiling = tiling;
    groundMat.emissiveMapTiling = tiling;
    groundMat.update();
  }

  function getRenderedXZ(id: string): { x: number; z: number } | null {
    const m = motions.get(id);
    if (!m) return null;
    const now = performance.now() / 1000;
    const u = Math.min(1, (now - m.startedAt) / Math.max(m.duration, 1e-4));
    const a = u * u * (3 - 2 * u);
    return {
      x: m.fromX + (m.toX - m.fromX) * a,
      z: m.fromZ + (m.toZ - m.fromZ) * a,
    };
  }

  function getCameraView(): CameraView {
    return {
      x: camViewX,
      z: camViewZ,
      ortho: viewOrthoHeight(camAspect),
      aspect: camAspect,
    };
  }

  function setCameraView(x: number, z: number): void {
    camViewX = x;
    camViewZ = z;
    applyCameraPose();
  }

  function panCamera(dViewX: number, dViewZ: number): void {
    setCameraView(camViewX + dViewX, camViewZ + dViewZ);
  }

  function goHomeCamera(): void {
    const homePos = homeCameraView(camAspect);
    setCameraView(homePos.x, homePos.z);
  }

  /**
   * CSS는 부모 100%, 버퍼만 client 크기 기준으로 맞춤.
   * app.resizeCanvas(w*dpr) 금지 — style이 커지며 뷰가 밀림.
   */
  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w < 2 || h < 2) return;

    canvas.style.width = "100%";
    canvas.style.height = "100%";
    // RESOLUTION_AUTO: 내부에서 DPR 곱함. 인자는 CSS 픽셀.
    app.graphicsDevice.resizeCanvas(w, h);
    updateCameraRig();
  };

  resize();
  const ro = new ResizeObserver(() => resize());
  if (canvas.parentElement) ro.observe(canvas.parentElement);
  window.addEventListener("resize", resize);

  const colorFor = (e: EntitySnap): pc.Color => {
    const mine =
      localSide == null ? e.side === "bottom" : e.side === localSide;
    if (e.kind === "mineral") return new pc.Color(0.35, 0.55, 0.95);
    if (e.kind === "gas") return new pc.Color(0.25, 0.72, 0.42);
    if (e.kind === "hq") {
      return mine
        ? new pc.Color(0.25, 0.55, 1.0)
        : new pc.Color(0.95, 0.32, 0.28);
    }
    if (e.kind === "worker") {
      return mine
        ? new pc.Color(0.9, 0.82, 0.35)
        : new pc.Color(0.85, 0.55, 0.25);
    }
    if (e.kind === "larva") return new pc.Color(0.62, 0.78, 0.28);
    if (e.kind === "egg") return new pc.Color(0.55, 0.35, 0.75);
    if (e.kind === "building") {
      return mine
        ? new pc.Color(0.45, 0.55, 0.7)
        : new pc.Color(0.65, 0.4, 0.4);
    }
    return mine ? new pc.Color(0.75, 0.85, 1) : new pc.Color(1, 0.7, 0.7);
  };

  const sizeFor = (
    e: EntitySnap
  ): { w: number; h: number; d: number } => {
    switch (e.kind) {
      case "hq":
        return { w: 6 * CELL, h: 1.0, d: 6 * CELL };
      case "building": {
        const fp = footprintOf(e.typeId);
        return { w: fp.w * CELL, h: 0.35, d: fp.d * CELL };
      }
      case "mineral":
        return { w: 3 * CELL, h: 0.45, d: 3 * CELL };
      case "gas":
        return { w: 3 * CELL, h: 0.28, d: 3 * CELL };
      case "worker":
        return { w: 0.38, h: 0.4, d: 0.38 };
      case "larva":
        return { w: 0.2, h: 0.1, d: 0.2 };
      case "egg":
        return { w: 0.32, h: 0.2, d: 0.32 };
      default:
        return { w: 0.42, h: 0.45, d: 0.42 };
    }
  };

  function spriteFoot(e: EntitySnap): { w: number; d: number } {
    return groundFoot(e);
  }

  function entityY(e: EntitySnap, usesSprite: boolean, size: { h: number }): number {
    const actor =
      e.kind === "unit" ||
      e.kind === "worker" ||
      e.kind === "larva" ||
      e.kind === "bolt";
    if (usesSprite) return actor ? ACTOR_Y : GROUND_Y + 0.08;
    return actor ? ACTOR_Y : GROUND_Y + size.h / 2;
  }

  function fogSightChanged(entities: EntitySnap[]): boolean {
    let changed = fogCell.size === 0;
    const keep = new Set<string>();
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.side !== localSide || e.inside) continue;
      if (
        e.kind !== "hq" &&
        e.kind !== "building" &&
        e.kind !== "worker" &&
        e.kind !== "unit" &&
        e.kind !== "larva"
      ) {
        continue;
      }
      keep.add(e.id);
      const v = toView(e.x, e.z);
      const c = viewToFogCell(v.x, v.z);
      const key = c.cx + c.cz * GRID_W;
      if (fogCell.get(e.id) !== key) {
        fogCell.set(e.id, key);
        changed = true;
      }
    }
    for (const id of fogCell.keys()) {
      if (!keep.has(id)) {
        fogCell.delete(id);
        changed = true;
      }
    }
    return changed;
  }

  function interpDuration(now: number): number {
    let dur = 0.1;
    if (prevSnapAt > 0) {
      const gap = now - prevSnapAt;
      if (gap > dur) dur = gap;
      if (dur > 0.2) dur = 0.2;
    }
    prevSnapAt = now;
    return dur;
  }

  function applySnapshot(snap: MatchSnapshot): void {
    overlayReorder = true;
    lastEntities = snap.entities.slice();
    const nextCreep = snap.creep || "";
    if (nextCreep !== creepPacked) {
      creepPacked = nextCreep;
      uploadCreepTexture();
    }
    if (fogSightChanged(lastEntities)) {
      syncFog(lastEntities, localSide);
      uploadFogTexture();
    }
    spawnHitFlashes(snap.hits);
    spawnDamagePops(snap.hits);
    noteAttackPoses(snap.hits, performance.now() / 1000);
    const seen = new Set<string>();
    const now = performance.now() / 1000;
    const moveDur = interpDuration(now);
    for (const e of snap.entities) {
      seen.add(e.id);
      let ent = entityMap.get(e.id);
      const size = sizeFor(e);
      const foot = spriteFoot(e);
      const drawType =
        e.constructing &&
        (e.kind === "building" || e.kind === "hq") &&
        e.typeId.indexOf("alien_") === 0
          ? "alien_warp"
          : e.typeId;
      const usesSprite = !!spriteUrl(e.typeId);
      const prevType = entityTypeIds.get(e.id);
      if (ent && prevType && prevType !== e.typeId) {
        ent.destroy();
        entityMap.delete(e.id);
        spriteEntityIds.delete(e.id);
        motions.delete(e.id);
        walkStarted.delete(e.id);
        walkApplied.delete(e.id);
        attackPoseUntil.delete(e.id);
        ent = undefined;
      }
      entityTypeIds.set(e.id, e.typeId);
      entityKinds.set(e.id, e.kind);
      const fresh = !ent;
      if (!ent) {
        ent =
          (usesSprite
            ? createSpriteEntity(e.id, drawType, foot.w, foot.d)
            : null) ??
          createBox(e.id, size.w, size.h, size.d, colorFor(e));
        app.root.addChild(ent);
        entityMap.set(e.id, ent);
        if (usesSprite && ent.render) spriteEntityIds.add(e.id);
      } else if (!usesSprite) {
        const mesh = ent.render?.meshInstances?.[0];
        if (mesh?.material && !spriteMats.has(e.typeId)) {
          const mat = mesh.material as pc.StandardMaterial;
          mat.diffuse = colorFor(e);
          mat.update();
        }
      }
      if (e.kind === "bolt" && fresh && e.attackerId) {
        attackPoseUntil.set(e.attackerId, now + ATTACK_POSE_SEC);
      }
      if (usesSprite) {
        const movableSprite =
          e.kind === "unit" ||
          e.kind === "worker" ||
          e.kind === "larva" ||
          e.kind === "bolt";
        if (!movableSprite) ent.setLocalEulerAngles(0, 0, 0);
        ent.setLocalScale(foot.w, 1, foot.d);
      }
      syncMineralCargo(ent, e);
      ent.enabled =
        fogRevealsEntity(e, localSide) &&
        !e.inside &&
        !(e.kind === "gas" && ventCovered(snap.entities, e));

      if (e.kind === "egg") {
        // 변태는 유충 좌표를 유지한다. 스냅샷 x/z 가 그 위치다.
        const v = toView(e.x, e.z);
        ent.setPosition(v.x, entityY(e, usesSprite, size), v.z);
        ent.setLocalEulerAngles(0, 0, 0);
        motions.delete(e.id);
        continue;
      }

      const y = entityY(e, usesSprite, size);
      const movable =
        e.kind === "unit" ||
        e.kind === "worker" ||
        e.kind === "larva" ||
        e.kind === "bolt";
      if (!movable || fresh) {
        const v = toView(e.x, e.z);
        ent.setPosition(v.x, y, v.z);
        motions.delete(e.id);
        continue;
      }

      const prev = motions.get(e.id);
      let fromX = e.x;
      let fromZ = e.z;
      let yaw = prev?.yaw ?? 0;
      if (prev) {
        const u = Math.min(1, (now - prev.startedAt) / Math.max(prev.duration, 1e-4));
        const a = u * u * (3 - 2 * u);
        fromX = prev.fromX + (prev.toX - prev.fromX) * a;
        fromZ = prev.fromZ + (prev.toZ - prev.fromZ) * a;
      } else {
        const p = ent.getPosition();
        const world =
          localSide === "top"
            ? { x: p.x, z: p.z }
            : { x: -p.x, z: -p.z };
        fromX = world.x;
        fromZ = world.z;
      }
      const yawOffset = 0;
      const aimX = typeof e.aimX === "number" ? e.aimX : null;
      const aimZ = typeof e.aimZ === "number" ? e.aimZ : null;
      if (locksFacing(e.typeId)) {
        yaw = 0;
      } else {
        const face =
          aimX != null && aimZ != null
            ? yawFromDelta(aimX - e.x, aimZ - e.z)
            : yawFromDelta(e.x - fromX, e.z - fromZ);
        if (face != null) yaw = face + yawOffset;
      }
      if (spriteEntityIds.has(e.id)) ent.setLocalEulerAngles(0, yaw, 0);
      motions.set(e.id, {
        fromX,
        fromZ,
        toX: e.x,
        toZ: e.z,
        y,
        yaw,
        yawOffset,
        aimX,
        aimZ,
        startedAt: now,
        duration: moveDur,
      });
    }
    for (const [id, ent] of entityMap) {
      if (!seen.has(id)) {
        const typeId = entityTypeIds.get(id);
        const kind = entityKinds.get(id);
        if (typeId && (kind === "unit" || kind === "worker")) {
          const scale = ent.getLocalScale();
          spawnDieBurst(typeId, ent.getPosition(), Math.max(scale.x, scale.z));
        }
        ent.destroy();
        entityMap.delete(id);
        motions.delete(id);
        spriteEntityIds.delete(id);
        entityTypeIds.delete(id);
        entityKinds.delete(id);
        walkStarted.delete(id);
        walkApplied.delete(id);
        attackPoseUntil.delete(id);
      }
    }
    updateSelectionVisual();
    overlayReorder = false;
  }

  function setLocalSide(side: Side | null): void {
    localSide = side ?? "bottom";
    fogCell.clear();
    prevSnapAt = 0;
    resetFog(localSide);
    syncFog(lastEntities, localSide);
    uploadFogTexture();
    uploadCreepTexture();
    for (let i = 0; i < lastEntities.length; i++) {
      const e = lastEntities[i];
      const ent = entityMap.get(e.id);
      if (ent) {
        ent.enabled =
          fogRevealsEntity(e, localSide) &&
          !e.inside &&
          !(e.kind === "gas" && ventCovered(lastEntities, e));
      }
    }
    updateCameraRig();
    goHomeCamera();
    updateSelectionVisual();
  }

  function setSelectedIds(ids: string[]): void {
    selectedIds = ids.slice();
    updateSelectionVisual();
  }

  return {
    applySnapshot,
    setLocalSide,
    setGhost,
    setPowerFields,
    setSelectedIds,
    getCameraView,
    getRenderedXZ,
    setCameraView,
    panCamera,
    goHomeCamera,
    whenAssetsReady: () => assetsReady,
    canvas,
    mouse,
    touch,
    destroy: () => {
      destroyed = true;
      for (let i = 0; i < pendingSpriteImgs.length; i++) {
        const img = pendingSpriteImgs[i];
        img.onload = null;
        img.onerror = null;
        img.src = "";
      }
      pendingSpriteImgs.length = 0;
      for (let i = 0; i < dieBursts.length; i++) dieBursts[i].root.destroy();
      dieBursts.length = 0;
      for (let i = 0; i < dmgPops.length; i++) dmgPops[i].el.remove();
      dmgPops.length = 0;
      dmgLayer.remove();
      dmgParticles.forEach((list) => destroyDmgList(list));
      dmgParticles.clear();
      entityKinds.clear();
      spriteMats.clear();
      ro.disconnect();
      window.removeEventListener("resize", resize);
      app.off("update", onUpdate);
      clearGhostSprite();
      fogTex.destroy();
      app.destroy();
      entityMap.clear();
      motions.clear();
      powerPads.length = 0;
    },
  };
}

function makeMaterial(color: pc.Color, opacity = 1): pc.StandardMaterial {
  const mat = new pc.StandardMaterial();
  mat.diffuse = color;
  mat.emissive = color;
  mat.emissiveIntensity = opacity < 1 ? 0.25 : 0.04;
  if (opacity < 1) {
    mat.opacity = opacity;
    mat.blendType = pc.BLEND_NORMAL;
  }
  mat.update();
  return mat;
}

function scrollDashMat(mat: pc.StandardMaterial, scroll: number): void {
  const off = mat.diffuseMapOffset ?? new pc.Vec2();
  off.x = 0;
  off.y = -scroll;
  mat.diffuseMapOffset = off;
  mat.emissiveMapOffset = off;
  mat.opacityMapOffset = off;
  mat.update();
}

type TargetMarker = {
  root: pc.Entity;
  sprite: pc.Entity;
  size: number;
};

/** 생성 스프라이트(PNG)만 사용. 로드 전에는 숨김. */
function createTargetMarker(
  app: pc.Application,
  name: string,
  typeId: string,
  size: number,
  opts: {
    trackImage: (img: HTMLImageElement) => void;
    alive: () => boolean;
  }
): TargetMarker {
  const root = new pc.Entity(name);
  const mat = new pc.StandardMaterial();
  mat.useLighting = false;
  mat.blendType = pc.BLEND_NORMAL;
  mat.cull = pc.CULLFACE_NONE;
  mat.depthTest = false;
  mat.depthWrite = false;
  mat.diffuse = new pc.Color(1, 1, 1);
  mat.emissive = new pc.Color(1, 1, 1);
  mat.emissiveIntensity = 1;
  mat.opacity = 0;
  mat.update();

  const sprite = new pc.Entity(`${name}-sprite`);
  sprite.addComponent("render", { type: "plane" });
  sprite.setLocalScale(size, 1, size);
  sprite.enabled = false;
  const mesh = sprite.render?.meshInstances?.[0];
  if (mesh) mesh.material = mat;
  root.addChild(sprite);

  const url = spriteUrl(typeId);
  if (url) {
    const img = new Image();
    opts.trackImage(img);
    img.onload = () => {
      if (!opts.alive() || !app.graphicsDevice) return;
      const tex = new pc.Texture(app.graphicsDevice, {
        mipmaps: true,
        minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      });
      tex.setSource(img);
      mat.diffuseMap = tex;
      mat.emissiveMap = tex;
      mat.opacityMap = tex;
      mat.opacityMapChannel = "a";
      mat.opacity = 1;
      mat.update();
      sprite.enabled = true;
    };
    img.src = url;
  }

  return { root, sprite, size };
}

function animateTargetMarker(
  marker: TargetMarker,
  pulse: number,
  spinDeg: number,
  _counterDeg: number
): void {
  const s = marker.size * pulse;
  marker.sprite.setLocalScale(s, 1, s);
  marker.sprite.setLocalEulerAngles(0, spinDeg, 0);
}

/** 반복 점선 텍스처(캔버스 1장). V축 REPEAT + offset 스크롤용. */
function createDashTexture(
  device: pc.GraphicsDevice,
  cssColor: string
): pc.Texture {
  const w = 8;
  const h = 32;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = cssColor;
  // 앞쪽 ~45% 대시, 나머지 투명 간격
  ctx.fillRect(1, 0, w - 2, Math.floor(h * 0.45));
  const tex = new pc.Texture(device, {
    mipmaps: false,
    minFilter: pc.FILTER_NEAREST,
    magFilter: pc.FILTER_NEAREST,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_REPEAT,
  });
  tex.setSource(canvas);
  return tex;
}

function createDashLine(
  app: pc.Application,
  name: string,
  cssColor: string
): { entity: pc.Entity; material: pc.StandardMaterial } {
  const tex = createDashTexture(app.graphicsDevice, cssColor);
  const mat = new pc.StandardMaterial();
  mat.useLighting = false;
  mat.blendType = pc.BLEND_NORMAL;
  mat.cull = pc.CULLFACE_NONE;
  mat.depthTest = false;
  mat.depthWrite = false;
  mat.diffuse = new pc.Color(1, 1, 1);
  mat.emissive = new pc.Color(1, 1, 1);
  mat.emissiveIntensity = 1;
  mat.diffuseMap = tex;
  mat.emissiveMap = tex;
  mat.opacityMap = tex;
  mat.opacityMapChannel = "a";
  mat.diffuseMapTiling = new pc.Vec2(1, 1);
  mat.emissiveMapTiling = new pc.Vec2(1, 1);
  mat.opacityMapTiling = new pc.Vec2(1, 1);
  mat.diffuseMapOffset = new pc.Vec2(0, 0);
  mat.emissiveMapOffset = new pc.Vec2(0, 0);
  mat.opacityMapOffset = new pc.Vec2(0, 0);
  mat.update();

  const entity = new pc.Entity(name);
  entity.addComponent("render", { type: "plane" });
  entity.setLocalScale(RALLY_LINE_WIDTH, 1, 1);
  const mesh = entity.render?.meshInstances?.[0];
  if (mesh) mesh.material = mat;
  entity.enabled = false;
  return { entity, material: mat };
}

function createBox(
  name: string,
  w: number,
  h: number,
  d: number,
  colorOrMat: pc.Color | pc.StandardMaterial,
  opacity = 1
): pc.Entity {
  const ent = new pc.Entity(name);
  ent.addComponent("render", {
    type: "box",
  });
  ent.setLocalScale(w, h, d);
  const mesh = ent.render?.meshInstances?.[0];
  if (mesh) {
    mesh.material =
      colorOrMat instanceof pc.StandardMaterial
        ? colorOrMat
        : makeMaterial(colorOrMat, opacity);
  }
  return ent;
}
