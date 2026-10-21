import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EntitySnap, MatchSnapshot, Side } from "../protocol";
import { IconCheck, IconClose } from "../ui/icons";
import { footprintOnCreep, needsCreep } from "./creep";
import { isGasBuilding } from "./gasVent";
import {
  CELL,
  etherFootprintFits,
  footprintCenter,
  footprintFits,
  footprintGhostPads,
  needsPylonPower,
  pylonPowerRects,
  screenToWorld,
  snapToCell,
  worldToCell,
  zoneCenterCell,
  GRID_W,
  GRID_D,
} from "./grid";
import { Minimap } from "./Minimap";
import {
  pickAttackTargetAt,
  pickEntitiesInBox,
  pickEntityAt,
  pickSameUnitsInView,
} from "./pick";
import {
  createPlayCanvasApp,
  type CameraView,
  type GhostCell,
  type PlayCanvasHandle,
} from "./playcanvasApp";
import { buildingDef } from "./roster";
import { bindPlayCanvasInput, type SurfacePoint } from "./surfaceInput";
import {
  getEntities,
  getSnapshot,
  pushSnapshot,
  subscribeSnapshot,
} from "./snapshotStore";
import { viewOrthoHeight, worldToScreenPercent } from "./worldView";

/** 건설 고스트의 시작 칸. 일꾼이 서 있는 칸, 없으면 진영 중앙. */
function ghostCellAtWorker(
  entities: EntitySnap[],
  workerId: string | null,
  side: Side
): { cx: number; cz: number } {
  if (workerId) {
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.id !== workerId || e.kind !== "worker") continue;
      const cell = worldToCell(e.x, e.z);
      if (cell.cx >= 0 && cell.cz >= 0 && cell.cx < GRID_W && cell.cz < GRID_D) {
        return cell;
      }
    }
  }
  return zoneCenterCell(side);
}

const DRAG_THRESHOLD_PX = 6;
/** 같은 유닛을 다시 누르면 화면 안 동일 유닛을 묶어서 선택 */
const DOUBLE_TAP_MS = 400;
const DOUBLE_TAP_PX = 36;

interface Props {
  snapshot: MatchSnapshot | null;
  entities?: EntitySnap[];
  localSide: Side | null;
  placing?: boolean;
  placeType?: string | null;
  placeWorkerId?: string | null;
  harvestWorkerIds?: string[];
  rallyBuildingId?: string | null;
  moveUnitIds?: string[];
  attackUnitIds?: string[];
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  onPlaceAt?: (x: number, z: number) => void;
  onCancelPlace?: () => void;
  onHarvestMineral?: (mineralId: string) => void;
  onCancelHarvest?: () => void;
  onSetRally?: (buildingId: string, x: number, z: number) => void;
  onCancelRally?: () => void;
  onOrderMove?: (unitIds: string[], x: number, z: number) => void;
  onCancelMove?: () => void;
  onOrderAttack?: (unitIds: string[], targetId: string) => void;
  onOrderAttackMove?: (unitIds: string[], x: number, z: number) => void;
  onCancelAttack?: () => void;
  onAssetsReady?: () => void;
}

type MarqueeBox = { left: number; top: number; width: number; height: number };

export function GameCanvas({
  snapshot,
  entities,
  localSide,
  placing = false,
  placeType = null,
  placeWorkerId = null,
  harvestWorkerIds = [],
  rallyBuildingId = null,
  moveUnitIds = [],
  attackUnitIds = [],
  selectedIds = [],
  onSelect,
  onPlaceAt,
  onCancelPlace,
  onHarvestMineral,
  onCancelHarvest,
  onSetRally,
  onCancelRally,
  onOrderMove,
  onCancelMove,
  onOrderAttack,
  onOrderAttackMove,
  onCancelAttack,
  onAssetsReady,
}: Props) {
  const viewRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<PlayCanvasHandle | null>(null);
  const assetsReadyRef = useRef(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [cameraView, setCameraView] = useState<CameraView | null>(null);
  const pointersRef = useRef(
    new Map<number, { x: number; y: number }>()
  );
  const panLastRef = useRef<{ x: number; y: number } | null>(null);
  const onAssetsReadyRef = useRef(onAssetsReady);
  onAssetsReadyRef.current = onAssetsReady;
  const sideRef = useRef(localSide);
  const entitiesRef = useRef(getEntities());
  const creepRef = useRef(getSnapshot()?.creep || "");
  const placeRef = useRef(onPlaceAt);
  const selectRef = useRef(onSelect);
  const harvestRef = useRef(onHarvestMineral);
  const cancelHarvestRef = useRef(onCancelHarvest);
  const setRallyRef = useRef(onSetRally);
  const cancelRallyRef = useRef(onCancelRally);
  const orderMoveRef = useRef(onOrderMove);
  const cancelMoveRef = useRef(onCancelMove);
  const orderAttackRef = useRef(onOrderAttack);
  const orderAttackMoveRef = useRef(onOrderAttackMove);
  const cancelAttackRef = useRef(onCancelAttack);
  const placingRef = useRef(placing);
  const placeTypeRef = useRef(placeType);
  const placeWorkerIdRef = useRef(placeWorkerId);
  const harvestWorkerRef = useRef(harvestWorkerIds);
  const rallyBuildingRef = useRef(rallyBuildingId);
  const moveUnitRef = useRef(moveUnitIds);
  const attackUnitRef = useRef(attackUnitIds);
  const cellRef = useRef<{ cx: number; cz: number } | null>(null);
  const armedTypeRef = useRef<string | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    dragging: boolean;
  } | null>(null);
  /** 맵에서 시작한 건물 고스트 이동. 이 포인터는 선택 드래그로 넘기지 않는다. */
  const placingPointerRef = useRef<number | null>(null);
  /** 이동·공격 등 무장 명령은 누를 때가 아니라 손을 뗄 때 확정한다. */
  const commandPointerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{
    id: string;
    t: number;
    x: number;
    y: number;
  } | null>(null);
  const [ghost, setGhost] = useState<GhostCell | null>(null);
  const [viewBox, setViewBox] = useState({ w: 1, h: 1 });
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);
  const showAtRef = useRef<(cx: number, cz: number) => void>(() => undefined);
  showAtRef.current = (cx, cz) => {
    const side = sideRef.current;
    const typeId = placeTypeRef.current;
    const def = typeId ? buildingDef(typeId) : null;
    if (!side || !def) {
      cellRef.current = null;
      setGhost(null);
      handleRef.current?.setGhost(null);
      return;
    }
    const ignore =
      placeWorkerIdRef.current != null
        ? new Set([placeWorkerIdRef.current])
        : null;
    const center = footprintCenter(cx, cz, def.w, def.d);
    const needPower = needsPylonPower(def.typeId);
    const gasMode = def.role === "gas";
    const fits = gasMode
      ? etherFootprintFits(
          entitiesRef.current,
          side,
          cx,
          cz,
          def.w,
          def.d,
          needPower,
          ignore
        )
      : footprintFits(
          entitiesRef.current,
          side,
          cx,
          cz,
          def.w,
          def.d,
          needPower,
          ignore
        );
    const onCreep =
      !needsCreep(def.typeId) ||
      footprintOnCreep(creepRef.current, cx, cz, def.w, def.d);
    const pads = footprintGhostPads(
      entitiesRef.current,
      side,
      cx,
      cz,
      def.w,
      def.d,
      ignore,
      gasMode ? "gas" : "normal"
    );
    const next: GhostCell = {
      x: center.x,
      z: center.z,
      w: def.w * CELL,
      d: def.d * CELL,
      typeId: def.typeId,
      valid: fits && onCreep,
      pads,
    };
    cellRef.current = { cx, cz };
    setGhost(next);
    handleRef.current?.setGhost(next);
  };
  sideRef.current = localSide;
  entitiesRef.current = getEntities().length ? getEntities() : entities ?? snapshot?.entities ?? [];
  creepRef.current = getSnapshot()?.creep || snapshot?.creep || "";
  placeRef.current = onPlaceAt;
  selectRef.current = onSelect;
  harvestRef.current = onHarvestMineral;
  cancelHarvestRef.current = onCancelHarvest;
  setRallyRef.current = onSetRally;
  cancelRallyRef.current = onCancelRally;
  orderMoveRef.current = onOrderMove;
  cancelMoveRef.current = onCancelMove;
  orderAttackRef.current = onOrderAttack;
  orderAttackMoveRef.current = onOrderAttackMove;
  cancelAttackRef.current = onCancelAttack;
  placingRef.current = placing;
  placeTypeRef.current = placeType;
  placeWorkerIdRef.current = placeWorkerId;
  harvestWorkerRef.current = harvestWorkerIds;
  rallyBuildingRef.current = rallyBuildingId;
  moveUnitRef.current = moveUnitIds;
  attackUnitRef.current = attackUnitIds;

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const canvas = document.createElement("canvas");
    canvas.className = "stage-canvas-el is-loading";
    view.appendChild(canvas);
    const handle = createPlayCanvasApp(canvas);
    handleRef.current = handle;
    assetsReadyRef.current = false;
    setAssetsReady(false);
    if (localSide) handle.setLocalSide(localSide);
    void handle.whenAssetsReady().then(() => {
      if (handleRef.current !== handle) return;
      assetsReadyRef.current = true;
      setAssetsReady(true);
      canvas.classList.remove("is-loading");
      const snap = getSnapshot();
      if (snap) {
        entitiesRef.current = snap.entities;
        handle.applySnapshot(snap);
      }
      // 리사이즈 이후 종횡비로 아군 본진을 화면 하단에 재정렬
      handle.goHomeCamera();
      setCameraView(handle.getCameraView());
      onAssetsReadyRef.current?.();
    });
    return () => {
      handle.destroy();
      handleRef.current = null;
      assetsReadyRef.current = false;
      canvas.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    handleRef.current?.setLocalSide(localSide);
    const h = handleRef.current;
    if (h) setCameraView(h.getCameraView());
  }, [localSide]);

  // 프리뷰·초기 주입만. 라이브는 onmatchdata→pushSnapshot이 소스.
  // React 스로틀 스냅샷으로 더 최신 스토어(낙관적 랠리 등)를 덮어쓰지 않는다.
  useEffect(() => {
    if (!snapshot) return;
    const cur = getSnapshot();
    if (cur && cur.tick >= snapshot.tick) return;
    pushSnapshot(snapshot);
  }, [snapshot]);

  // 월드 갱신은 React state를 거치지 않고 스토어 구독 → PlayCanvas 보간.
  // 에셋 준비 전에는 스냅샷을 올리지 않아 흰 플레이스홀더가 보이지 않는다.
  useEffect(() => {
    const apply = () => {
      if (!assetsReadyRef.current) return;
      const snap = getSnapshot();
      if (!snap) return;
      entitiesRef.current = snap.entities;
      creepRef.current = snap.creep || "";
      handleRef.current?.applySnapshot(snap);
      if (placingRef.current && cellRef.current) {
        showAtRef.current(cellRef.current.cx, cellRef.current.cz);
      }
    };
    apply();
    return subscribeSnapshot(apply);
  }, []);

  useEffect(() => {
    handleRef.current?.setSelectedIds(selectedIds);
  }, [selectedIds]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const apply = () => {
      const rect = view.getBoundingClientRect();
      setViewBox({ w: rect.width, h: rect.height });
      const h = handleRef.current;
      if (h) setCameraView(h.getCameraView());
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(view);
    const id = window.setInterval(() => {
      const h = handleRef.current;
      if (h) setCameraView(h.getCameraView());
    }, 100);
    return () => {
      ro.disconnect();
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!placing || !placeType || !localSide) {
      cellRef.current = null;
      armedTypeRef.current = null;
      placingPointerRef.current = null;
      setGhost(null);
      handleRef.current?.setGhost(null);
      handleRef.current?.setPowerFields([]);
      return;
    }
    if (armedTypeRef.current !== placeType || !cellRef.current) {
      armedTypeRef.current = placeType;
      cellRef.current = ghostCellAtWorker(
        entitiesRef.current,
        placeWorkerId,
        localSide
      );
    }
    showAtRef.current(cellRef.current.cx, cellRef.current.cz);
    const showPower =
      placeType.indexOf("alien_") === 0 &&
      (placeType === "alien_pylon" || needsPylonPower(placeType));
    handleRef.current?.setPowerFields(
      showPower ? pylonPowerRects(entitiesRef.current, localSide) : []
    );
  }, [placing, placeType, placeWorkerId, localSide, entities, snapshot]);

  useEffect(() => {
    const view = viewRef.current;
    const handle = handleRef.current;
    if (!view || !handle) return;

    const worldAt = (clientX: number, clientY: number) => {
      const side = sideRef.current;
      if (!side) return null;
      const rect = view.getBoundingClientRect();
      const aspect = rect.width / Math.max(rect.height, 1);
      const cam = handleRef.current?.getCameraView();
      return screenToWorld(
        clientX,
        clientY,
        rect,
        side,
        viewOrthoHeight(aspect),
        cam?.x ?? 0,
        cam?.z ?? 0
      );
    };

    const syncCameraState = () => {
      const h = handleRef.current;
      if (h) setCameraView(h.getCameraView());
    };

    const panFromScreenDelta = (_dx: number, dy: number) => {
      const h = handleRef.current;
      if (!h) return;
      const rect = view.getBoundingClientRect();
      const cam = h.getCameraView();
      // 가로는 맵에 고정 — 세로만 패닝
      const dViewZ = -(dy / Math.max(rect.height, 1)) * cam.ortho * 2;
      h.panCamera(0, dViewZ);
      syncCameraState();
    };

    const readCell = (ev: SurfacePoint) => {
      const world = worldAt(ev.clientX, ev.clientY);
      if (!world) return null;
      return snapToCell(world.x, world.z);
    };

    const armedMode = () =>
      !!(
        placingRef.current ||
        harvestWorkerRef.current.length ||
        rallyBuildingRef.current ||
        moveUnitRef.current.length ||
        attackUnitRef.current.length
      );

    const marqueeFrom = (d: {
      startX: number;
      startY: number;
      curX: number;
      curY: number;
    }): MarqueeBox => {
      const left = Math.min(d.startX, d.curX);
      const top = Math.min(d.startY, d.curY);
      return {
        left,
        top,
        width: Math.abs(d.curX - d.startX),
        height: Math.abs(d.curY - d.startY),
      };
    };

    const finishClick = (ev: SurfacePoint) => {
      const side = sideRef.current;
      const world = worldAt(ev.clientX, ev.clientY);
      const ordering =
        harvestWorkerRef.current.length > 0 ||
        !!rallyBuildingRef.current ||
        moveUnitRef.current.length > 0 ||
        attackUnitRef.current.length > 0;
      if (!world || !side) {
        if (ordering) return;
        lastTapRef.current = null;
        selectRef.current?.([]);
        return;
      }

      if (
        harvestWorkerRef.current.length ||
        rallyBuildingRef.current ||
        moveUnitRef.current.length ||
        attackUnitRef.current.length
      ) {
        lastTapRef.current = null;
      }

      if (harvestWorkerRef.current.length) {
        const hit = pickEntityAt(entitiesRef.current, world.x, world.z, side);
        const mineral = hit && hit.kind === "mineral" && hit.side === side;
        const ether =
          hit &&
          hit.side === side &&
          isGasBuilding(hit) &&
          !hit.constructing;
        if (hit && (mineral || ether)) {
          harvestRef.current?.(hit.id);
          return;
        }
        cancelHarvestRef.current?.();
        return;
      }

      if (rallyBuildingRef.current) {
        setRallyRef.current?.(rallyBuildingRef.current, world.x, world.z);
        return;
      }

      if (moveUnitRef.current.length) {
        orderMoveRef.current?.(moveUnitRef.current, world.x, world.z);
        return;
      }

      if (attackUnitRef.current.length) {
        const attackerIds = attackUnitRef.current;
        const hit = pickAttackTargetAt(
          entitiesRef.current,
          world.x,
          world.z,
          side,
          attackerIds,
          (e) => handleRef.current?.getRenderedXZ(e.id) ?? null
        );
        if (hit) {
          orderAttackRef.current?.(attackerIds, hit.id);
          return;
        }
        orderAttackMoveRef.current?.(attackerIds, world.x, world.z);
        return;
      }

      const hit = pickEntityAt(entitiesRef.current, world.x, world.z, side);
      const now = performance.now();
      const prev = lastTapRef.current;
      const doubled =
        !!hit &&
        !!prev &&
        prev.id === hit.id &&
        now - prev.t <= DOUBLE_TAP_MS &&
        Math.hypot(ev.clientX - prev.x, ev.clientY - prev.y) <= DOUBLE_TAP_PX;
      if (doubled && hit) {
        lastTapRef.current = null;
        const cam = handleRef.current?.getCameraView();
        const rect = view.getBoundingClientRect();
        selectRef.current?.(
          pickSameUnitsInView(entitiesRef.current, hit, {
            side,
            aspect: cam?.aspect ?? rect.width / Math.max(rect.height, 1),
            camX: cam?.x ?? 0,
            camZ: cam?.z ?? 0,
          })
        );
        return;
      }
      lastTapRef.current = hit
        ? { id: hit.id, t: now, x: ev.clientX, y: ev.clientY }
        : null;
      selectRef.current?.(hit ? [hit.id] : []);
    };

    const isPrimaryPress = (ev: SurfacePoint) => {
      if (ev.kind === "mouse") return ev.button === 0;
      return ev.button === 0;
    };

    /**
     * 오버레이 UI — React stopPropagation 보다 뷰 native 리스너가 먼저라 걸러낸다.
     * 모바일에서 target 이 Text 노드이거나 HUD(pointer-events:none) 아래로
     * 잘못 전달되는 경우가 있어 elementFromPoint 로도 확인한다.
     * 여기서 놓치면 preventDefault 가 click 을 죽여 확정/취소가 안 눌린다.
     */
    const isOverlayUiAt = (clientX: number, clientY: number) => {
      const top = document.elementFromPoint(clientX, clientY);
      return !!top?.closest(".ghost-actions, .minimap");
    };
    const eventEl = (ev: { target: EventTarget | null }): Element | null => {
      const t = ev.target;
      if (t instanceof Element) return t;
      if (t instanceof Node) return t.parentElement;
      return null;
    };
    const isGhostUiEvent = (ev: SurfacePoint) => {
      const el = eventEl(ev);
      if (el?.closest(".ghost-actions, .minimap")) return true;
      return isOverlayUiAt(ev.clientX, ev.clientY);
    };

    const blockBrowserGesture = (ev: SurfacePoint) => {
      if (ev.kind === "touch") ev.preventDefault();
    };

    const move = (ev: SurfacePoint) => {
      const tracking = pointersRef.current.has(ev.id);
      if (!tracking && isGhostUiEvent(ev)) return;
      if (tracking) {
        pointersRef.current.set(ev.id, { x: ev.clientX, y: ev.clientY });
      }

      // 두 손가락 또는 마우스 중/우클릭 패닝
      const panActive =
        (ev.buttons & 4) !== 0 ||
        (ev.buttons & 2) !== 0 ||
        (pointersRef.current.size >= 2 && !!panLastRef.current);
      if (panActive && panLastRef.current) {
        blockBrowserGesture(ev);
        let cx = ev.clientX;
        let cy = ev.clientY;
        if (pointersRef.current.size >= 2) {
          const pts = Array.from(pointersRef.current.values());
          cx = (pts[0].x + pts[1].x) * 0.5;
          cy = (pts[0].y + pts[1].y) * 0.5;
        }
        panFromScreenDelta(cx - panLastRef.current.x, cy - panLastRef.current.y);
        panLastRef.current = { x: cx, y: cy };
        return;
      }

      if (placingRef.current && placingPointerRef.current === ev.id) {
        blockBrowserGesture(ev);
        const cell = readCell(ev);
        if (cell) showAtRef.current(cell.cx, cell.cz);
        return;
      }
      if (placingRef.current) return;

      if (commandPointerRef.current === ev.id) {
        blockBrowserGesture(ev);
        return;
      }

      const drag = dragRef.current;
      if (!drag || drag.pointerId !== ev.id) return;
      blockBrowserGesture(ev);
      const rect = view.getBoundingClientRect();
      drag.curX = ev.clientX - rect.left;
      drag.curY = ev.clientY - rect.top;
      const dist = Math.hypot(drag.curX - drag.startX, drag.curY - drag.startY);
      if (!drag.dragging && dist >= DRAG_THRESHOLD_PX) {
        drag.dragging = true;
      }
      if (drag.dragging) {
        setMarquee(marqueeFrom(drag));
      }
    };

    const down = (ev: SurfacePoint) => {
      if (isGhostUiEvent(ev)) return;
      pointersRef.current.set(ev.id, { x: ev.clientX, y: ev.clientY });

      // 중/우클릭 또는 두 번째 터치 → 카메라 패닝
      if (ev.button === 1 || ev.button === 2 || pointersRef.current.size >= 2) {
        blockBrowserGesture(ev);
        if (ev.button === 2) ev.preventDefault();
        commandPointerRef.current = null;
        dragRef.current = null;
        setMarquee(null);
        if (pointersRef.current.size >= 2) {
          const pts = Array.from(pointersRef.current.values());
          panLastRef.current = {
            x: (pts[0].x + pts[1].x) * 0.5,
            y: (pts[0].y + pts[1].y) * 0.5,
          };
        } else {
          panLastRef.current = { x: ev.clientX, y: ev.clientY };
        }
        return;
      }

      if (!isPrimaryPress(ev)) return;
      if (dragRef.current && dragRef.current.pointerId !== ev.id) return;
      blockBrowserGesture(ev);

      if (placingRef.current) {
        const cell = readCell(ev);
        if (cell) showAtRef.current(cell.cx, cell.cz);
        placingPointerRef.current = ev.id;
        dragRef.current = null;
        setMarquee(null);
        return;
      }

      if (armedMode()) {
        ev.preventDefault();
        ev.stopPropagation();
        commandPointerRef.current = ev.id;
        dragRef.current = null;
        setMarquee(null);
        return;
      }

      const rect = view.getBoundingClientRect();
      dragRef.current = {
        pointerId: ev.id,
        startX: ev.clientX - rect.left,
        startY: ev.clientY - rect.top,
        curX: ev.clientX - rect.left,
        curY: ev.clientY - rect.top,
        dragging: false,
      };
    };

    const endDrag = (ev: SurfacePoint, commit: boolean) => {
      pointersRef.current.delete(ev.id);
      if (pointersRef.current.size < 2) panLastRef.current = null;

      if (placingPointerRef.current === ev.id) placingPointerRef.current = null;

      const drag = dragRef.current;
      if (!drag || drag.pointerId !== ev.id) {
        return;
      }
      dragRef.current = null;
      setMarquee(null);
      if (!commit || placingRef.current) return;

      if (drag.dragging) {
        lastTapRef.current = null;
        const side = sideRef.current;
        if (!side) {
          selectRef.current?.([]);
          return;
        }
        const rect = view.getBoundingClientRect();
        const a = worldAt(rect.left + drag.startX, rect.top + drag.startY);
        const b = worldAt(rect.left + drag.curX, rect.top + drag.curY);
        if (!a || !b) {
          selectRef.current?.([]);
          return;
        }
        const ids = pickEntitiesInBox(
          entitiesRef.current,
          a.x,
          b.x,
          a.z,
          b.z,
          side,
          b.x,
          b.z
        );
        selectRef.current?.(ids);
        return;
      }

      finishClick(ev);
    };

    const up = (ev: SurfacePoint) => {
      if (commandPointerRef.current === ev.id) {
        commandPointerRef.current = null;
        pointersRef.current.delete(ev.id);
        if (pointersRef.current.size < 2) panLastRef.current = null;
        if (armedMode()) finishClick(ev);
        return;
      }
      endDrag(ev, true);
    };

    const cancel = (ev: SurfacePoint) => {
      if (commandPointerRef.current === ev.id) {
        commandPointerRef.current = null;
        pointersRef.current.delete(ev.id);
        if (pointersRef.current.size < 2) panLastRef.current = null;
        return;
      }
      endDrag(ev, false);
    };

    const onContextMenu = (ev: Event) => {
      ev.preventDefault();
    };

    view.addEventListener("contextmenu", onContextMenu);
    const unbind = bindPlayCanvasInput(handle.mouse, handle.touch, {
      down,
      move,
      up,
      cancel,
    });
    return () => {
      unbind();
      view.removeEventListener("contextmenu", onContextMenu);
      handleRef.current?.setGhost(null);
    };
  }, []);

  const aspect = viewBox.w / Math.max(viewBox.h, 1);
  const anchor =
    ghost && localSide
      ? worldToScreenPercent(
          ghost.x,
          ghost.z,
          localSide,
          aspect,
          cameraView?.x ?? 0,
          cameraView?.z ?? 0
        )
      : null;
  /** HUD(z-index:2) 위에 올려 모바일 터치가 버튼에 닿게 한다 */
  const ghostScreen =
    placing && anchor && viewBox.w > 0
      ? (() => {
          const rect = viewRef.current?.getBoundingClientRect();
          if (!rect) return null;
          return {
            left: rect.left + (anchor.left / 100) * rect.width,
            top: rect.top + (anchor.top / 100) * rect.height,
          };
        })()
      : null;

  return (
    <div
      className={
        placing ||
        harvestWorkerIds.length ||
        rallyBuildingId ||
        moveUnitIds.length ||
        attackUnitIds.length
          ? "stage-canvas-view is-placing"
          : "stage-canvas-view"
      }
      ref={viewRef}
    >
      {!assetsReady ? (
        <div className="battle-assets-loading" role="status" aria-live="polite">
          <p className="battle-assets-loading-label">전장 준비 중</p>
        </div>
      ) : null}
      {assetsReady ? (
        <Minimap
          entities={
            getEntities().length
              ? getEntities()
              : entities ?? snapshot?.entities ?? []
          }
          localSide={localSide}
          camera={cameraView}
          creep={getSnapshot()?.creep || snapshot?.creep || ""}
          orderArmed={moveUnitIds.length > 0 || attackUnitIds.length > 0}
          onOrderAt={(x, z) => {
            if (moveUnitIds.length) {
              onOrderMove?.(moveUnitIds, x, z);
              return;
            }
            if (!attackUnitIds.length) return;
            const ents =
              getEntities().length
                ? getEntities()
                : entities ?? snapshot?.entities ?? [];
            const hit = pickAttackTargetAt(
              ents,
              x,
              z,
              localSide,
              attackUnitIds,
              (e) => handleRef.current?.getRenderedXZ(e.id) ?? null
            );
            if (hit) {
              onOrderAttack?.(attackUnitIds, hit.id);
              return;
            }
            onOrderAttackMove?.(attackUnitIds, x, z);
          }}
          onFocus={(_viewX, viewZ) => {
            handleRef.current?.setCameraView(0, viewZ);
            setCameraView(handleRef.current?.getCameraView() ?? null);
          }}
          onHome={() => {
            handleRef.current?.goHomeCamera();
            setCameraView(handleRef.current?.getCameraView() ?? null);
          }}
        />
      ) : null}
      {marquee ? (
        <div
          className="sel-marquee"
          style={{
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height,
          }}
          aria-hidden="true"
        />
      ) : null}
      {ghostScreen
        ? createPortal(
            <div
              className="ghost-actions"
              style={{ left: ghostScreen.left, top: ghostScreen.top }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onPointerMove={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="sf-btn sf-btn-primary ghost-ok"
                aria-label="확정"
                disabled={!ghost?.valid}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onPointerUp={(event) => {
                  // click 은 touch+preventDefault 환경에서 유실될 수 있어 pointerup 사용
                  event.stopPropagation();
                  if (event.button !== 0 && event.button !== -1) return;
                  if (ghost?.valid) placeRef.current?.(ghost.x, ghost.z);
                }}
              >
                <IconCheck size={17} />
              </button>
              <button
                type="button"
                className="sf-btn ghost-cancel"
                aria-label="취소"
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => {
                  event.stopPropagation();
                  if (event.button !== 0 && event.button !== -1) return;
                  onCancelPlace?.();
                }}
              >
                <IconClose size={17} />
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
