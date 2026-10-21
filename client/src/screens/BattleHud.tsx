import {
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { EntitySnap, PlayerSnap, RaceId } from "../protocol";
import { StageBottomSlot } from "../scenes/scenes";
import {
  IconAttack,
  IconBack,
  IconBuild,
  IconGas,
  IconHarvest,
  IconMineral,
  IconMove,
  IconRally,
  IconUnit,
} from "../ui/icons";
import { roundResource } from "../ui/format";
import { MAX_SELECT } from "../game/pick";
import {
  buildingsFor,
  hasReadyBuilding,
  supplyCount,
  unitCost,
  unitsAt,
  LARVA_CAP,
} from "../game/roster";
import { ventAmountForBuilding } from "../game/gasVent";
import { hpTone, outlineUrl, portraitUrl, spriteUrl } from "../game/sprites";
import {
  idsWithCommand,
  selectionHasCommand,
} from "../game/unitCommands";
import { entityName, raceOf } from "../ui/races";
import { BattleResourceStrip, ScreenFill } from "../ui/widgets";

interface Props {
  me: PlayerSnap;
  enemy?: PlayerSnap;
  entities: EntitySnap[];
  queue?: { id: string; label: string }[];
  onProduce?: (
    buildingId: string,
    unitType: string,
    larvaIds?: string[]
  ) => void;
  placeType?: string | null;
  onArmPlace?: (typeId: string | null, workerId?: string | null) => void;
  harvestWorkerIds?: string[];
  onArmHarvest?: (workerIds: string[] | null) => void;
  rallyBuildingId?: string | null;
  onArmRally?: (buildingId: string | null) => void;
  onClearRally?: (buildingId: string) => void;
  moveUnitIds?: string[];
  onArmMove?: (unitIds: string[] | null) => void;
  attackUnitIds?: string[];
  onArmAttack?: (unitIds: string[] | null) => void;
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  onCancelQueue?: (buildingId: string, queueIndex: number) => void;
  onCancelMorph?: (eggId: string) => void;
}

export function BattleHud({
  me,
  entities,
  onProduce,
  placeType = null,
  onArmPlace,
  harvestWorkerIds = [],
  onArmHarvest,
  rallyBuildingId = null,
  onArmRally,
  onClearRally,
  moveUnitIds = [],
  onArmMove,
  attackUnitIds = [],
  onArmAttack,
  selectedIds = [],
  onSelect,
  onCancelQueue,
  onCancelMorph,
}: Props) {
  const energy = roundResource(me.energy);
  const minerals = roundResource(me.minerals);
  const counted = supplyCount(me.side, me.race, entities);
  const supply = me.supply ?? counted.used;
  const supplyMax = me.supplyMax ?? counted.max;

  useEffect(() => {
    if (!selectedIds.length) return;
    const alive = new Set(entities.map((e) => e.id));
    const next = selectedIds.filter((id) => alive.has(id)).slice(0, MAX_SELECT);
    if (
      next.length !== selectedIds.length ||
      next.some((id, i) => id !== selectedIds[i])
    ) {
      onSelect?.(next);
    }
  }, [entities, selectedIds, onSelect]);

  const selectedGroup = selectedIds
    .map((id) => entities.find((e) => e.id === id))
    .filter((e): e is EntitySnap => !!e)
    .slice(0, MAX_SELECT);
  const selected = selectedGroup[0];
  const multiSelect = selectedGroup.length > 1;
  const bottomSlot = useContext(StageBottomSlot);

  const allOwnLarva =
    selectedGroup.length > 0 &&
    selectedGroup.every((e) => e.kind === "larva" && e.side === me.side);
  const actions =
    selected && !multiSelect
      ? produceOptions(me, selected, entities, supply, supplyMax, 1)
      : allOwnLarva
        ? produceOptions(
            me,
            selected,
            entities,
            supply,
            supplyMax,
            selectedGroup.length
          )
        : [];
  const info =
    selected && bottomSlot
      ? createPortal(
          multiSelect ? (
            <MultiSelectPanel
              key={`multi-${selectedGroup.map((e) => e.id).join(",")}`}
              units={selectedGroup}
              meSide={me.side}
              moveArmed={selectedGroup.some((e) => moveUnitIds.includes(e.id))}
              onArmMove={onArmMove}
              attackArmed={selectedGroup.some((e) =>
                attackUnitIds.includes(e.id)
              )}
              onArmAttack={onArmAttack}
              harvestArmed={selectedGroup.some((e) =>
                harvestWorkerIds.includes(e.id)
              )}
              onArmHarvest={onArmHarvest}
              onPickUnit={(id) => onSelect?.([id])}
              produceActions={allOwnLarva ? actions : []}
              onProduce={onProduce}
            />
          ) : (
            <SelectionPanel
              key={selected.id}
              selected={selected}
              meSide={me.side}
              race={me.race}
              energy={energy}
              minerals={minerals}
              entities={entities}
              actions={actions}
              placeType={placeType}
              onArmPlace={onArmPlace}
              harvestArmed={harvestWorkerIds.includes(selected.id)}
              onArmHarvest={onArmHarvest}
              rallyArmed={rallyBuildingId === selected.id}
              onArmRally={onArmRally}
              onClearRally={onClearRally}
              moveArmed={moveUnitIds.includes(selected.id)}
              onArmMove={onArmMove}
              attackArmed={attackUnitIds.includes(selected.id)}
              onArmAttack={onArmAttack}
              onProduce={onProduce}
              onCancelQueue={onCancelQueue}
              onCancelMorph={onCancelMorph}
            />
          ),
          bottomSlot
        )
      : null;

  return (
    <ScreenFill>
      <header className="battle-top">
        <BattleResourceStrip
          minerals={me.minerals}
          gas={me.energy}
          supply={supply}
          supplyMax={supplyMax}
        />
      </header>
      {placeType ? (
        <p className="battle-guide" role="status">
          건설 위치를 지정하세요
        </p>
      ) : rallyBuildingId ? (
        <p className="battle-guide" role="status">
          랠리포인트 위치를 지정하세요
        </p>
      ) : moveUnitIds.length ? (
        <p className="battle-guide" role="status">
          이동할 위치를 지정하세요
        </p>
      ) : attackUnitIds.length ? (
        <p className="battle-guide" role="status">
          공격할 유닛 또는 위치를 지정하세요
        </p>
      ) : harvestWorkerIds.length ? (
        <p className="battle-guide" role="status">
          채취할 자원을 지정하세요
        </p>
      ) : null}
      <div className="battle-body" />
      {info}
    </ScreenFill>
  );
}

function SelPortrait({
  unit,
  size,
  frameClass = "",
}: {
  unit: EntitySnap;
  size: "single" | "multi";
  frameClass?: string;
}) {
  const faceId = unit.typeId;
  const portrait = portraitUrl(faceId);
  const outline = outlineUrl(faceId);
  const sprite = spriteUrl(faceId);
  const face = portrait ?? sprite;
  const tone = hpTone(unit.hp, unit.maxHp);
  const isMulti = size === "multi";

  // 초상화가 없을 때만 SC식 와이어프레임 폴백
  if (!portrait && outline) {
    const maskStyle = {
      WebkitMaskImage: `url(${outline})`,
      maskImage: `url(${outline})`,
    } as const;
    if (isMulti) {
      return (
        <span
          className={`sel-outline-fill is-hp-${tone}`}
          style={maskStyle}
          aria-hidden="true"
        />
      );
    }
    return (
      <div
        className={`sel-portrait is-wire is-${unit.kind} is-hp-${tone} ${frameClass}`.trim()}
        aria-hidden="true"
      >
        <span className="sel-outline-fill" style={maskStyle} />
      </div>
    );
  }

  if (isMulti) {
    return face ? (
      <img
        className="sel-multi-sprite"
        src={face}
        alt=""
        draggable={false}
      />
    ) : (
      <span className={`sel-silhouette is-${unit.kind}`} />
    );
  }

  const hpClass = frameClass.includes("is-neutral") || frameClass.includes("is-enemy")
    ? ""
    : `is-hp-${tone}`;

  return (
    <div
      className={`sel-portrait is-${unit.kind} ${hpClass} ${frameClass}`.trim()}
      aria-hidden="true"
    >
      {face ? (
        <img className="sel-sprite" src={face} alt="" draggable={false} />
      ) : unit.kind === "mineral" ? (
        <IconMineral size={28} />
      ) : unit.kind === "gas" ? (
        <IconGas size={28} />
      ) : (
        <span className={`sel-silhouette is-${unit.kind}`} />
      )}
    </div>
  );
}

function MultiSelectPanel({
  units,
  meSide,
  moveArmed = false,
  onArmMove,
  attackArmed = false,
  onArmAttack,
  harvestArmed = false,
  onArmHarvest,
  onPickUnit,
  produceActions = [],
  onProduce,
}: {
  units: EntitySnap[];
  meSide: PlayerSnap["side"];
  moveArmed?: boolean;
  onArmMove?: (unitIds: string[] | null) => void;
  attackArmed?: boolean;
  onArmAttack?: (unitIds: string[] | null) => void;
  harvestArmed?: boolean;
  onArmHarvest?: (workerIds: string[] | null) => void;
  onPickUnit?: (id: string) => void;
  produceActions?: { typeId: string; name: string; enabled: boolean }[];
  onProduce?: (
    buildingId: string,
    unitType: string,
    larvaIds?: string[]
  ) => void;
}) {
  const [unitListOpen, setUnitListOpen] = useState(false);
  const mine = units.every((u) => u.side === meSide);
  const own = mine ? units : [];
  const moveIds = idsWithCommand(own, "move");
  const attackIds = idsWithCommand(own, "attack");
  const harvestIds = idsWithCommand(own, "harvest");
  const canMove = moveIds.length > 0;
  const canAttack = attackIds.length > 0;
  const canHarvest = harvestIds.length > 0;
  const moveLit =
    moveArmed ||
    (moveIds.length > 0 && moveIds.every((id) => movingUnit(units, id)));
  const attackLit =
    attackArmed ||
    (attackIds.length > 0 && attackIds.every((id) => attackingUnit(units, id)));
  const harvestLit =
    harvestArmed ||
    (harvestIds.length > 0 &&
      harvestIds.every((id) => harvestingUnit(units, id)));
  const canProduce = produceActions.length > 0;
  const commandCount =
    (canMove ? 1 : 0) +
    (canAttack ? 1 : 0) +
    (canHarvest ? 1 : 0) +
    (canProduce ? 1 : 0);
  const cells = Array.from({ length: MAX_SELECT }, (_, i) => units[i] ?? null);
  const larvaIds = units.filter((u) => u.kind === "larva").map((u) => u.id);

  if (unitListOpen && canProduce) {
    return (
      <div className="cmd-bar is-build-list">
        <DragScroll>
          {produceActions.map((action) => (
            <button
              key={action.typeId}
              type="button"
              className="cmd-btn sf-btn sel-unit-btn"
              disabled={!action.enabled}
              aria-label={action.name}
              onClick={() => {
                if (!action.enabled || !larvaIds.length) return;
                onProduce?.(larvaIds[0], action.typeId, larvaIds);
              }}
            >
              {spriteUrl(action.typeId) ? (
                <img
                  className="cmd-sprite"
                  src={spriteUrl(action.typeId)!}
                  alt=""
                  draggable={false}
                />
              ) : (
                <span className="sel-silhouette is-unit" />
              )}
            </button>
          ))}
        </DragScroll>
        <button
          type="button"
          className="cmd-btn cmd-back sf-btn"
          aria-label="뒤로가기"
          onClick={() => setUnitListOpen(false)}
        >
          <IconBack size={22} />
        </button>
      </div>
    );
  }

  return (
    <section
      className="sel-card is-multi"
      aria-label={`선택 ${units.length}기`}
    >
      <div className="sel-info">
        <div className="sel-multi-grid" role="list">
          {cells.map((unit, i) =>
            unit ? (
              <button
                key={unit.id}
                type="button"
                className="sel-multi-cell is-pick"
                role="listitem"
                aria-label={`${entityName(unit.typeId, unit.kind)} 단독 선택`}
                onClick={() => onPickUnit?.(unit.id)}
              >
                <SelPortrait unit={unit} size="multi" />
              </button>
            ) : (
              <div
                key={`empty-${i}`}
                className="sel-multi-cell is-empty"
                role="listitem"
                aria-hidden="true"
              />
            )
          )}
        </div>
      </div>
      {canMove || canAttack || canHarvest || canProduce ? (
        <div
          className={
            commandCount === 1 ? "sel-actions is-single" : "sel-actions"
          }
        >
          {canMove ? (
            <button
              type="button"
              className={`cmd-btn sf-btn sel-unit-btn${moveLit ? " is-armed" : ""}`}
              aria-label="이동"
              aria-pressed={moveLit}
              onClick={() => onArmMove?.(moveArmed ? null : moveIds)}
            >
              <IconMove size={22} />
            </button>
          ) : null}
          {canAttack ? (
            <button
              type="button"
              className={`cmd-btn sf-btn sel-unit-btn${attackLit ? " is-armed" : ""}`}
              aria-label="공격"
              aria-pressed={attackLit}
              onClick={() => onArmAttack?.(attackArmed ? null : attackIds)}
            >
              <IconAttack size={22} />
            </button>
          ) : null}
          {canHarvest ? (
            <button
              type="button"
              className={`cmd-btn sf-btn sel-unit-btn${harvestLit ? " is-armed" : ""}`}
              aria-label="채취"
              aria-pressed={harvestLit}
              onClick={() =>
                onArmHarvest?.(harvestArmed ? null : harvestIds)
              }
            >
              <IconHarvest size={22} />
            </button>
          ) : null}
          {canProduce ? (
            <button
              type="button"
              className="cmd-btn sf-btn sel-unit-btn"
              aria-label="유닛"
              onClick={() => setUnitListOpen(true)}
            >
              <IconUnit size={22} />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SelectionPanel({
  selected,
  meSide,
  race,
  energy,
  minerals,
  entities,
  actions,
  placeType = null,
  onArmPlace,
  harvestArmed = false,
  onArmHarvest,
  rallyArmed = false,
  onArmRally,
  onClearRally,
  moveArmed = false,
  onArmMove,
  attackArmed = false,
  onArmAttack,
  onProduce,
  onCancelQueue,
  onCancelMorph,
}: {
  selected: EntitySnap;
  meSide: PlayerSnap["side"];
  race: RaceId;
  energy: number;
  minerals: number;
  entities: EntitySnap[];
  actions: { typeId: string; name: string; enabled: boolean }[];
  placeType?: string | null;
  onArmPlace?: (typeId: string | null, workerId?: string | null) => void;
  harvestArmed?: boolean;
  onArmHarvest?: (workerIds: string[] | null) => void;
  rallyArmed?: boolean;
  onArmRally?: (buildingId: string | null) => void;
  onClearRally?: (buildingId: string) => void;
  moveArmed?: boolean;
  onArmMove?: (unitIds: string[] | null) => void;
  attackArmed?: boolean;
  onArmAttack?: (unitIds: string[] | null) => void;
  onProduce?: (
    buildingId: string,
    unitType: string,
    larvaIds?: string[]
  ) => void;
  onCancelQueue?: (buildingId: string, queueIndex: number) => void;
  onCancelMorph?: (eggId: string) => void;
}) {
  const [unitListOpen, setUnitListOpen] = useState(false);
  const [buildListOpen, setBuildListOpen] = useState(false);
  const neutral = selected.kind === "mineral" || selected.kind === "gas";
  const enemy = !neutral && selected.side !== meSide;
  const canProduce = actions.length > 0;
  const canRally =
    canProduce &&
    !enemy &&
    (selected.kind === "building" || selected.kind === "hq");
  const rallyPointSet =
    typeof selected.rallyX === "number" &&
    typeof selected.rallyZ === "number" &&
    Number.isFinite(selected.rallyX) &&
    Number.isFinite(selected.rallyZ);
  /** 위치 지정 모드·랠리 지정됨 모두 활성(is-armed) 표시 */
  const rallyButtonArmed = rallyArmed || rallyPointSet;
  const moveLit = moveArmed || isMoving(selected);
  const attackLit = attackArmed || isAttacking(selected);
  const harvestLit = harvestArmed || !!selected.harvesting;
  const buildLit = !!placeType || !!selected.building;
  const ownUnit =
    !enemy && selected.side === meSide ? [selected] : [];
  const canMove = selectionHasCommand(ownUnit, "move");
  const canAttack = selectionHasCommand(ownUnit, "attack");
  const canHarvest = selectionHasCommand(ownUnit, "harvest");
  const canBuild = selectionHasCommand(ownUnit, "build");
  const canCommand = canMove || canAttack;
  const commandCount =
    (canMove ? 1 : 0) +
    (canAttack ? 1 : 0) +
    (canRally ? 1 : 0) +
    (canProduce ? 1 : 0) +
    (canBuild ? 1 : 0) +
    (canHarvest ? 1 : 0);
  const ownSite =
    !enemy &&
    !neutral &&
    selected.side === meSide &&
    (selected.kind === "building" || selected.kind === "hq");
  const ownEgg =
    !enemy && selected.kind === "egg" && selected.side === meSide;
  const monsterProducer = isMonsterProducer(selected);
  const idleLarva = larvaCount(entities, selected) ?? 0;
  const queue = selected.queue ?? [];
  /** 괴물: 동시 생산 한도 = 유충 수. 그 외: 건물 큐 5 */
  const queueFull = monsterProducer ? idleLarva <= 0 : queue.length >= 5;
  const morphTypeId = selected.morphType;
  const buildProgress =
    selected.constructing &&
    typeof selected.buildLeft === "number" &&
    typeof selected.buildSec === "number" &&
    selected.buildSec > 0
      ? Math.max(0, Math.min(1, 1 - selected.buildLeft / selected.buildSec))
      : null;
  const prodProgress =
    !selected.constructing &&
    queue.length > 0 &&
    typeof selected.prodLeft === "number" &&
    typeof selected.prodSec === "number" &&
    selected.prodSec > 0
      ? Math.max(0, Math.min(1, 1 - selected.prodLeft / selected.prodSec))
      : null;
  const morphProgress =
    ownEgg &&
    typeof selected.morphLeft === "number" &&
    typeof selected.morphSec === "number" &&
    selected.morphSec > 0
      ? Math.max(0, Math.min(1, 1 - selected.morphLeft / selected.morphSec))
      : null;
  const progress = buildProgress ?? prodProgress ?? morphProgress;
  const selTitle = entityName(selected.typeId, selected.kind);
  const gasRemain = ventAmountForBuilding(entities, selected);

  if (buildListOpen && canBuild) {
    const buildings = buildingsFor(race);
    return (
      <div className="cmd-bar is-build-list">
        <DragScroll>
          {buildings.map((building) => {
            const techOk =
              !building.needs ||
              hasReadyBuilding(entities, meSide, building.needs);
            const afford =
              techOk &&
              energy >= building.costE &&
              minerals >= building.costM;
            return (
              <button
                key={building.typeId}
                type="button"
                className={`cmd-btn sf-btn sel-unit-btn${
                  placeType === building.typeId ? " is-armed" : ""
                }`}
                disabled={!afford}
                aria-label={building.name}
                aria-pressed={placeType === building.typeId}
                onClick={() => {
                  onArmPlace?.(
                    placeType === building.typeId ? null : building.typeId,
                    selected.id
                  );
                }}
              >
                {spriteUrl(building.typeId) ? (
                  <img
                    className="cmd-sprite"
                    src={spriteUrl(building.typeId)!}
                    alt=""
                    draggable={false}
                  />
                ) : (
                  <span className="sel-silhouette is-building" />
                )}
              </button>
            );
          })}
        </DragScroll>
        <button
          type="button"
          className="cmd-btn cmd-back sf-btn"
          aria-label="뒤로가기"
          onClick={() => {
            setBuildListOpen(false);
            onArmPlace?.(null);
          }}
        >
          <IconBack size={22} />
        </button>
      </div>
    );
  }

  if (unitListOpen && canProduce) {
    return (
      <div className="cmd-bar is-build-list">
        <DragScroll>
          {actions.map((action) => (
            <button
              key={action.typeId}
              type="button"
              className="cmd-btn sf-btn sel-unit-btn"
              disabled={!action.enabled || queueFull}
              aria-label={action.name}
              onClick={() => {
                if (queueFull) return;
                if (selected.kind === "larva") {
                  onProduce?.(selected.id, action.typeId, [selected.id]);
                  return;
                }
                onProduce?.(selected.id, action.typeId);
              }}
            >
              {spriteUrl(action.typeId) ? (
                <img
                  className="cmd-sprite"
                  src={spriteUrl(action.typeId)!}
                  alt=""
                  draggable={false}
                />
              ) : (
                <span className="sel-silhouette is-unit" />
              )}
            </button>
          ))}
        </DragScroll>
        <button
          type="button"
          className="cmd-btn cmd-back sf-btn"
          aria-label="뒤로가기"
          onClick={() => setUnitListOpen(false)}
        >
          <IconBack size={22} />
        </button>
      </div>
    );
  }

  return (
    <section
      className={`sel-card${
        (ownSite && (progress != null || queue.length > 0)) || ownEgg
          ? " has-prod"
          : ""
      }`}
      aria-label={selTitle}
    >
      <div className="sel-info">
        <div className="sel-face">
          <SelPortrait
            unit={selected}
            size="single"
            frameClass={neutral ? "is-neutral" : enemy ? "is-enemy" : ""}
          />
          {selected.kind !== "mineral" && selected.kind !== "gas" ? (
            <p className="sel-hp">
              {Math.ceil(selected.hp)}/{Math.ceil(selected.maxHp)}
            </p>
          ) : null}
        </div>
        <div className="sel-copy">
          <p className="sel-name">{selTitle}</p>
          {larvaCount(entities, selected) != null ? (
            <p className="sel-larva">
              유충 {larvaCount(entities, selected)}/{LARVA_CAP}
            </p>
          ) : null}
          {selected.kind === "mineral" ? (
            <p className="sel-remain">매장량: {Math.ceil(selected.hp)}</p>
          ) : null}
          {selected.kind === "gas" ? (
            <p className="sel-remain">매장량: {Math.ceil(selected.hp)}</p>
          ) : null}
          {gasRemain != null ? (
            <p className="sel-remain">매장량: {Math.ceil(gasRemain)}</p>
          ) : null}
          {ownSite && selected.constructing && progress != null ? (
            <ProdGauge
              value={progress}
              label="건설 진행"
            />
          ) : null}
          {ownEgg && morphTypeId ? (
            <ProdQueue
              label="변태"
              slots={[morphTypeId, null, null, null, null]}
              hideIndexes={[1, 2, 3, 4]}
              progress={progress}
              progressLabel="변태 진행"
              onCancel={() => onCancelMorph?.(selected.id)}
            />
          ) : null}
          {ownSite && !monsterProducer && queue.length > 0 && !selected.constructing ? (
            <ProdQueue
              label={`생산 대기열 ${queue.length}/5`}
              slots={Array.from({ length: 5 }, (_, i) => queue[i] ?? null)}
              progress={progress}
              progressLabel="생산 진행"
              onCancel={(index) => onCancelQueue?.(selected.id, index)}
            />
          ) : null}
        </div>
      </div>
      {canRally || canProduce || canHarvest || canBuild || canCommand ? (
        <div
          className={
            commandCount === 1 ? "sel-actions is-single" : "sel-actions"
          }
        >
          {canMove ? (
            <button
              type="button"
              className={`cmd-btn sf-btn sel-unit-btn${moveLit ? " is-armed" : ""}`}
              aria-label="이동"
              aria-pressed={moveLit}
              onClick={() => onArmMove?.(moveArmed ? null : [selected.id])}
            >
              <IconMove size={22} />
            </button>
          ) : null}
          {canAttack ? (
            <button
              type="button"
              className={`cmd-btn sf-btn sel-unit-btn${attackLit ? " is-armed" : ""}`}
              aria-label="공격"
              aria-pressed={attackLit}
              onClick={() =>
                onArmAttack?.(attackArmed ? null : [selected.id])
              }
            >
              <IconAttack size={22} />
            </button>
          ) : null}
          {canRally ? (
            <button
              type="button"
              className={`cmd-btn sf-btn sel-unit-btn is-rally-cmd${
                rallyButtonArmed ? " is-armed" : ""
              }${rallyPointSet ? " is-rally-set" : ""}`}
              aria-label="랠리"
              aria-pressed={rallyButtonArmed}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                // 랠리 지정됨 → 해제만 (위치 지정 모드로 들어가지 않음)
                // 무장 중 → 무장 해제
                // 그 외 → 위치 지정 모드
                if (rallyPointSet) {
                  onClearRally?.(selected.id);
                  return;
                }
                if (rallyArmed) {
                  onArmRally?.(null);
                  return;
                }
                onArmRally?.(selected.id);
              }}
            >
              <IconRally size={22} />
            </button>
          ) : null}
          {canProduce ? (
            <button
              type="button"
              className="cmd-btn sf-btn sel-unit-btn"
              aria-label="유닛"
              onClick={() => setUnitListOpen(true)}
            >
              <IconUnit size={22} />
            </button>
          ) : null}
          {canBuild ? (
            <button
              type="button"
              className={`cmd-btn sf-btn sel-unit-btn${buildLit ? " is-armed" : ""}`}
              aria-label="건물"
              aria-pressed={buildLit}
              onClick={() => setBuildListOpen(true)}
            >
              <IconBuild size={22} />
            </button>
          ) : null}
          {canHarvest ? (
            <button
              type="button"
              className={`cmd-btn sf-btn sel-unit-btn${harvestLit ? " is-armed" : ""}`}
              aria-label="채취"
              aria-pressed={harvestLit}
              onClick={() =>
                onArmHarvest?.(harvestArmed ? null : [selected.id])
              }
            >
              <IconHarvest size={22} />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** 건설 이동은 이동 버튼이 아니라 건설 버튼에 표시한다. */
function isMoving(e: EntitySnap): boolean {
  return e.order === "move" && !e.building;
}

function isAttacking(e: EntitySnap): boolean {
  return e.order === "attack" || e.order === "attack_move";
}

function movingUnit(units: EntitySnap[], id: string): boolean {
  const unit = units.find((u) => u.id === id);
  return !!unit && isMoving(unit);
}

function attackingUnit(units: EntitySnap[], id: string): boolean {
  const unit = units.find((u) => u.id === id);
  return !!unit && isAttacking(unit);
}

function harvestingUnit(units: EntitySnap[], id: string): boolean {
  const unit = units.find((u) => u.id === id);
  return !!unit && !!unit.harvesting;
}

const GAUGE_CELLS = 16;

function ProdGauge({ value, label }: { value: number; label: string }) {
  const filled = Math.max(0, Math.min(1, value)) * GAUGE_CELLS;
  return (
    <div
      className="prod-gauge"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-label={label}
    >
      {Array.from({ length: GAUGE_CELLS }, (_, i) => {
        const amount = Math.max(0, Math.min(1, filled - i));
        return (
          <span key={i} className="prod-gauge-cell">
            <span
              className="prod-gauge-cell-fill"
              style={{ width: `${amount * 100}%` }}
            />
          </span>
        );
      })}
    </div>
  );
}

function ProdSlot({
  typeId,
  index,
  hidden,
  onCancel,
}: {
  typeId: string | null;
  index: number;
  hidden: boolean;
  onCancel?: (index: number) => void;
}) {
  if (hidden) {
    return <div className="prod-slot is-hidden" aria-hidden="true" />;
  }
  if (typeId) {
    return (
      <button
        type="button"
        className="prod-slot is-filled"
        title="클릭하여 생산 취소"
        onClick={() => onCancel?.(index)}
      >
        {spriteUrl(typeId) ? (
          <img
            className="prod-slot-sprite"
            src={spriteUrl(typeId)!}
            alt=""
            draggable={false}
          />
        ) : (
          <span className="sel-silhouette is-unit" />
        )}
      </button>
    );
  }
  return (
    <div className="prod-slot is-empty" aria-hidden="true">
      <span className="prod-slot-num">{index + 1}</span>
    </div>
  );
}

/** 건물 생산 대기열과 같은 5칸. hideIndexes 는 0-based (1번 슬롯 = 0). */
function ProdQueue({
  label,
  slots,
  hideIndexes = [],
  progress = null,
  progressLabel = "생산 진행",
  onCancel,
}: {
  label: string;
  slots: (string | null)[];
  hideIndexes?: number[];
  progress?: number | null;
  progressLabel?: string;
  onCancel?: (index: number) => void;
}) {
  const hidden = new Set(hideIndexes);
  const rest = slots.slice(1);
  const showRest = rest.some((_, i) => !hidden.has(i + 1));
  return (
    <div className="prod-block" aria-label={label}>
      <div className="prod-active">
        <ProdSlot
          typeId={slots[0] ?? null}
          index={0}
          hidden={hidden.has(0)}
          onCancel={onCancel}
        />
        {progress != null ? (
          <ProdGauge value={progress} label={progressLabel} />
        ) : null}
      </div>
      {showRest ? (
        <div className="prod-queue">
          {rest.map((typeId, i) => (
            <ProdSlot
              key={`q-${i + 1}`}
              typeId={typeId}
              index={i + 1}
              hidden={hidden.has(i + 1)}
              onCancel={onCancel}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function isMonsterProducer(entity: EntitySnap): boolean {
  if (entity.kind === "hq" && entity.typeId.indexOf("monster") === 0) return true;
  return entity.typeId === "monster_hatch";
}

function larvaCount(entities: EntitySnap[], selected: EntitySnap): number | null {
  const producer = isMonsterProducer(selected);
  if (!producer && typeof selected.larva !== "number") return null;
  let n = 0;
  for (const e of entities) {
    if (e.kind !== "larva" || e.side !== selected.side) continue;
    if (e.homeId === selected.id || (!e.homeId && selected.kind === "hq")) n += 1;
  }
  return n > 0 || producer ? n : (selected.larva ?? n);
}

function produceOptions(
  me: PlayerSnap,
  selected: EntitySnap,
  entities: EntitySnap[],
  supply: number,
  supplyMax: number,
  larvaSlots = 1
): { typeId: string; name: string; enabled: boolean }[] {
  if (selected.side !== me.side || selected.constructing) return [];
  const energy = roundResource(me.energy);
  const minerals = roundResource(me.minerals);
  const queued = (selected.queue ?? []).length;
  const idleLarva =
    selected.kind === "larva"
      ? Math.max(1, larvaSlots)
      : me.race === "monster"
        ? (larvaCount(entities, selected) ?? 0)
        : 0;
  const canAfford = (typeId: string) => {
    const c = unitCost(typeId);
    if (!c) return false;
    if (me.race === "monster") {
      if (idleLarva <= 0) return false;
    } else if (queued >= 5) {
      return false;
    }
    return (
      energy >= c.costE &&
      minerals >= c.costM &&
      supply + c.supply <= supplyMax
    );
  };
  const place =
    selected.kind === "larva"
      ? "larva"
      : selected.kind === "hq"
        ? "hq"
        : selected.typeId;
  return unitsAt(me.race, place).map((row) => ({
    typeId: row.typeId,
    name: row.name,
    enabled:
      (!row.needs || hasReadyBuilding(entities, me.side, row.needs)) &&
      canAfford(row.typeId),
  }));
}

function DragScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, x: 0, left: 0, moved: false });
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    // 탭은 캡처하지 않아 버튼 native click이 살아있게 둔다.
    // 실제로 드래그될 때만 capture + scroll 한다.
    drag.current = { active: true, x: event.clientX, left: el.scrollLeft, moved: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || !drag.current.active) return;
    const dx = event.clientX - drag.current.x;
    if (Math.abs(dx) <= 6) return;
    if (!drag.current.moved) {
      drag.current.moved = true;
      setDragging(true);
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
    el.scrollLeft = drag.current.left - dx;
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!drag.current.active) return;
    const moved = drag.current.moved;
    drag.current.active = false;
    drag.current.moved = false;
    setDragging(false);
    if (el?.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
    // 드래그 후 남는 ghost click 이 버튼을 누르지 않게 차단
    if (moved) {
      const swallow = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      };
      document.addEventListener("click", swallow, { capture: true, once: true });
    }
  };

  return (
    <div
      ref={ref}
      className={`cmd-scroll${dragging ? " is-dragging" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {children}
    </div>
  );
}

export function battleQueuePlaceholder(
  race: RaceId
): { id: string; label: string }[] {
  const unit = raceOf(race).unit;
  return [
    { id: "q1", label: unit },
    { id: "q2", label: unit },
  ];
}
