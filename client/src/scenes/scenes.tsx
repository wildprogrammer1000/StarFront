import { createContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { GameCanvas } from "../game/GameCanvas";
import type { EntitySnap, MatchSnapshot, RaceId, Side } from "../protocol";

/** 전장 캔버스 아래 하단 UI가 포탈로 붙는 슬롯 */
export const StageBottomSlot = createContext<HTMLDivElement | null>(null);

function StageFrame({
  race,
  scene,
  children,
}: {
  race: RaceId;
  scene: "lobby" | "game";
  children: ReactNode;
}) {
  return (
    <div className="app-root">
      <div className={`stage scene-${scene}`} data-race={race} data-scene={scene}>
        {children}
      </div>
    </div>
  );
}

/** 접속·로비·매칭. 3D 전장을 만들지 않는다. */
export function LobbyScene({ race, children }: { race: RaceId; children: ReactNode }) {
  return (
    <StageFrame race={race} scene="lobby">
      <div className="hud hud-lobby">{children}</div>
    </StageFrame>
  );
}

/** 대기·전투·결과. PlayCanvas 전장 위에 HUD를 올린다. */
export function GameScene({
  race,
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
  systemNotice = null,
  children,
}: {
  race: RaceId;
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
  systemNotice?: string | null;
  children: ReactNode;
}) {
  const [bottomSlot, setBottomSlot] = useState<HTMLDivElement | null>(null);
  const bottomShellRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const shell = bottomShellRef.current;
    const slot = bottomSlot;
    if (!shell || !slot) return;
    const apply = () => {
      const style = getComputedStyle(shell);
      const base = parseFloat(style.getPropertyValue("--stage-bottom-h")) || 112;
      const safe = parseFloat(style.paddingBottom) || 0;
      const border = parseFloat(style.borderTopWidth) || 0;
      const content = slot.offsetHeight;
      const next = Math.max(base, content) + safe + border;
      shell.style.height = `${next}px`;
      shell.style.flexBasis = `${next}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(slot);
    return () => {
      ro.disconnect();
      shell.style.height = "";
      shell.style.flexBasis = "";
    };
  }, [bottomSlot]);

  return (
    <StageBottomSlot.Provider value={bottomSlot}>
      <StageFrame race={race} scene="game">
        <div
          className={
            placing ||
            harvestWorkerIds.length ||
            rallyBuildingId ||
            moveUnitIds.length ||
            attackUnitIds.length
              ? "stage-canvas-wrap is-placing"
              : "stage-canvas-wrap"
          }
        >
          <GameCanvas
            snapshot={snapshot}
            entities={entities}
            localSide={localSide}
            placing={placing}
            placeType={placeType}
            placeWorkerId={placeWorkerId}
            harvestWorkerIds={harvestWorkerIds}
            rallyBuildingId={rallyBuildingId}
            moveUnitIds={moveUnitIds}
            attackUnitIds={attackUnitIds}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onPlaceAt={onPlaceAt}
            onCancelPlace={onCancelPlace}
            onHarvestMineral={onHarvestMineral}
            onCancelHarvest={onCancelHarvest}
            onSetRally={onSetRally}
            onCancelRally={onCancelRally}
            onOrderMove={onOrderMove}
            onCancelMove={onCancelMove}
            onOrderAttack={onOrderAttack}
            onOrderAttackMove={onOrderAttackMove}
            onCancelAttack={onCancelAttack}
            systemNotice={systemNotice}
          />
          <div className="stage-bottom-ui" ref={bottomShellRef}>
            <div className="stage-bottom-ui-slot" ref={setBottomSlot} />
          </div>
        </div>
        <div className="hud hud-game">{children}</div>
      </StageFrame>
    </StageBottomSlot.Provider>
  );
}
