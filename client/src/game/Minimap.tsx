import { useEffect, useRef } from "react";
import { bindSurfaceInput } from "./surfaceInput";
import type { EntitySnap, Side } from "../protocol";
import { paintCreepMinimap } from "./creep";
import { ventCovered } from "./gasVent";
import { fogAlphaAt, fogRevealsEntity, syncFog } from "./fog";
import { GRID_D, GRID_W, HALF_D, HALF_W } from "./grid";
import type { CameraView } from "./playcanvasApp";
import { toView } from "./worldView";

/** 월드 단위당 픽셀 — 가로·세로 동일 스케일로 실제 맵 비율 유지 */
const PX_PER_WORLD = 8;
const W = Math.round(HALF_W * 2 * PX_PER_WORLD);
const H = Math.round(HALF_D * 2 * PX_PER_WORLD);

function mapToCanvas(vx: number, vz: number): { x: number; y: number } {
  return {
    x: ((vx + HALF_W) / (HALF_W * 2)) * W,
    y: ((vz + HALF_D) / (HALF_D * 2)) * H,
  };
}

function canvasToView(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): { viewX: number; viewZ: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const nx = (clientX - rect.left) / rect.width;
  const ny = (clientY - rect.top) / rect.height;
  return {
    viewX: -HALF_W + nx * HALF_W * 2,
    viewZ: -HALF_D + ny * HALF_D * 2,
  };
}

export function Minimap({
  entities,
  localSide,
  camera,
  onFocus,
  onHome,
  creep = "",
  orderArmed = false,
  onOrderAt,
}: {
  entities: EntitySnap[];
  localSide: Side | null;
  camera: CameraView | null;
  /** 서버 크립 비트열 */
  creep?: string;
  onFocus: (viewX: number, viewZ: number) => void;
  onHome: () => void;
  /** 이동/공격 무장 — 클릭 시 카메라 대신 지점 명령 */
  orderArmed?: boolean;
  onOrderAt?: (worldX: number, worldZ: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    syncFog(entities, localSide);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 탐험된 지형 바탕
    ctx.fillStyle = "#1a242e";
    ctx.fillRect(0, 0, W, H);

    if (creep) paintCreepMinimap(ctx, creep, localSide, W, H);

    for (const e of entities) {
      if (!fogRevealsEntity(e, localSide)) continue;
      if (e.inside) continue;
      if (e.kind === "gas" && ventCovered(entities, e)) continue;
      const v = toView(e.x, e.z, localSide);
      const p = mapToCanvas(v.x, v.z);
      if (e.kind === "mineral") {
        ctx.fillStyle = "#4a8cff";
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      } else if (e.kind === "gas") {
        ctx.fillStyle = "#3dbf6a";
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      } else if (e.kind === "egg") {
        const mine = localSide ? e.side === localSide : e.side === "bottom";
        ctx.fillStyle = mine ? "#c090ff" : "#a06080";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "hq") {
        const mine = localSide ? e.side === localSide : e.side === "bottom";
        ctx.fillStyle = mine ? "#4a9fff" : "#e05048";
        ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      } else if (e.kind === "building") {
        const mine = localSide ? e.side === localSide : e.side === "bottom";
        ctx.fillStyle = mine ? "#6ec8ff" : "#ff8870";
        ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
      } else if (
        e.kind === "worker" ||
        e.kind === "unit" ||
        e.kind === "larva"
      ) {
        const mine = localSide ? e.side === localSide : e.side === "bottom";
        ctx.fillStyle = mine ? "#9dff6a" : "#ff6a6a";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 안개 오버레이 (셀 단위)
    const cellW = W / GRID_W;
    const cellH = H / GRID_D;
    for (let cz = 0; cz < GRID_D; cz++) {
      for (let cx = 0; cx < GRID_W; cx++) {
        const a = fogAlphaAt(cx, cz);
        if (a <= 0) continue;
        ctx.fillStyle = `rgba(0,0,0,${a / 255})`;
        ctx.fillRect(cx * cellW, cz * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    ctx.strokeStyle = "rgba(125, 255, 74, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    if (camera) {
      const tl = mapToCanvas(-HALF_W, camera.z - camera.ortho);
      const br = mapToCanvas(HALF_W, camera.z + camera.ortho);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }
  }, [entities, localSide, camera, creep]);

  const onFocusRef = useRef(onFocus);
  const onOrderAtRef = useRef(onOrderAt);
  const orderArmedRef = useRef(orderArmed);
  const sideRef = useRef(localSide);
  onFocusRef.current = onFocus;
  onOrderAtRef.current = onOrderAt;
  orderArmedRef.current = orderArmed;
  sideRef.current = localSide;

  const focusAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const view = canvasToView(canvas, clientX, clientY);
    if (!view) return;
    onFocusRef.current(0, view.viewZ);
  };

  const orderAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const order = onOrderAtRef.current;
    if (!canvas || !order) return;
    const view = canvasToView(canvas, clientX, clientY);
    if (!view) return;
    // toView 는 대칭 — 뷰→월드 변환에 동일 함수 사용
    const world = toView(view.viewX, view.viewZ, sideRef.current);
    order(world.x, world.z);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return bindSurfaceInput(canvas, {
      down: (point) => {
        point.stopPropagation();
        point.preventDefault();
        if (orderArmedRef.current && onOrderAtRef.current) {
          orderAt(point.clientX, point.clientY);
          return;
        }
        dragRef.current = true;
        focusAt(point.clientX, point.clientY);
      },
      move: (point) => {
        if (!dragRef.current) return;
        point.stopPropagation();
        point.preventDefault();
        focusAt(point.clientX, point.clientY);
      },
      up: () => {
        dragRef.current = false;
      },
      cancel: () => {
        dragRef.current = false;
      },
    });
  }, []);

  return (
    <div
      className={orderArmed ? "minimap is-order" : "minimap"}
      aria-label="미니맵"
    >
      <canvas
        ref={canvasRef}
        className="minimap-canvas"
        style={{ width: W, height: H }}
      />
      <button
        type="button"
        className="minimap-home"
        aria-label="아군 기지로 카메라 이동"
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onHome();
        }}
      >
        기지
      </button>
    </div>
  );
}
