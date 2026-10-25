import type { ReactNode } from "react";
import type { RaceId } from "../protocol";
import { formatCoord, roundResource } from "./format";
import {
  IconAlien,
  IconEnergy,
  IconGas,
  IconHuman,
  IconCommand,
  IconMineral,
  IconMonster,
  IconSupply,
} from "./icons";
import { ENERGY_CAP, SUPPLY_CAP, type RaceProfile } from "./races";
import { useAnimatedNumber } from "./useAnimatedNumber";

export function RacePlate({
  race,
  selected,
  onSelect,
}: {
  race: RaceProfile;
  selected: boolean;
  onSelect: (id: RaceId) => void;
}) {
  return (
    <button
      type="button"
      className={selected ? "race-plate is-selected" : "race-plate"}
      data-race={race.id}
      aria-pressed={selected}
      onClick={() => onSelect(race.id)}
    >
      <span className="race-mark" aria-hidden="true">
        {race.id === "human" && <IconHuman />}
        {race.id === "monster" && <IconMonster />}
        {race.id === "alien" && <IconAlien />}
      </span>
      <span className="race-name">{race.name}</span>
      <span className="race-unit">{race.unit}</span>
    </button>
  );
}

export function ResourceReadout({
  kind,
  value,
  max,
}: {
  kind: "energy" | "mineral";
  value: number;
  max?: number;
}) {
  const shown = roundResource(value);
  if (kind === "energy") {
    const cap = max ?? ENERGY_CAP;
    return (
      <div className="resource resource-energy" aria-label={`에테르 ${shown} / ${cap}`}>
        <span className="resource-icon">
          <IconEnergy />
        </span>
        <span className="resource-body">
          <span className="resource-num">
            {shown}
            <span className="resource-cap">/{cap}</span>
          </span>
          <span className="pips" aria-hidden="true">
            {Array.from({ length: cap }, (_, i) => (
              <span key={i} className={i < shown ? "pip on" : "pip"} />
            ))}
          </span>
        </span>
      </div>
    );
  }
  return (
    <div className="resource resource-mineral" aria-label={`미네랄 ${shown}`}>
      <span className="resource-icon">
        <IconMineral />
      </span>
      <span className="resource-num">{shown}</span>
    </div>
  );
}

function AnimatedResNum({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const { value: shown, dir } = useAnimatedNumber(value);
  return (
    <span
      className={`sc-res-num${dir ? ` is-${dir}` : ""}${className ? ` ${className}` : ""}`}
    >
      {shown}
    </span>
  );
}

/** 우측 상단: 미네랄 · 에테르 · 인구 */
export function BattleResourceStrip({
  minerals,
  gas,
  supply,
  supplyMax = SUPPLY_CAP,
  onOpenMenu,
}: {
  minerals: number;
  gas: number;
  supply: number;
  supplyMax?: number;
  onOpenMenu?: () => void;
}) {
  const m = roundResource(minerals);
  const g = roundResource(gas);
  const s = roundResource(supply);
  const over = supply > supplyMax;
  return (
    <div
      className="sc-resources"
      aria-label={`미네랄 ${m}, 에테르 ${g}, 유닛 ${s} / ${supplyMax}`}
    >
      <span className="sc-res sc-res-mineral">
        <IconMineral size={14} />
        <AnimatedResNum value={minerals} />
      </span>
      <span className="sc-res sc-res-gas">
        <IconGas size={14} />
        <AnimatedResNum value={gas} />
      </span>
      <span className={`sc-res sc-res-supply${over ? " is-over" : ""}`}>
        <IconSupply size={14} />
        <span className="sc-res-supply-pair">
          <AnimatedResNum value={supply} />
          <span>/{supplyMax}</span>
        </span>
      </span>
      <button
        type="button"
        className="battle-menu-btn"
        aria-label="메뉴"
        aria-haspopup="dialog"
        onClick={onOpenMenu}
      >
        <IconCommand size={16} />
      </button>
    </div>
  );
}

export function HpBar({
  tone,
  label,
  hp,
  maxHp,
}: {
  tone: "ally" | "enemy";
  label: string;
  hp: number;
  maxHp: number;
}) {
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const low = tone === "ally" && ratio > 0 && ratio <= 0.3;
  const pct = Math.round(ratio * 100);
  return (
    <div className={`hp hp-${tone}${low ? " is-low" : ""}`}>
      <div className="hp-meta">
        <span className="hp-tag">{tone === "ally" ? "아군" : "적"}</span>
        <span className="hp-name">{label}</span>
        <span className="hp-value">{Math.ceil(hp)}</span>
      </div>
      <div
        className="hp-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={maxHp}
        aria-valuenow={Math.ceil(hp)}
        aria-label={`${tone === "ally" ? "아군" : "적"} ${label} 내구 ${pct}%`}
      >
        <span className="hp-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function QueueSlots({
  items,
  max = 5,
}: {
  items: { id: string; label: string }[];
  max?: number;
}) {
  const slots = Array.from({ length: max }, (_, i) => items[i]);
  return (
    <div className="queue" aria-label={`생산 대기열 ${items.length} / ${max}`}>
      {slots.map((item, i) => (
        <div
          key={item?.id ?? `empty-${i}`}
          className={item ? "queue-slot is-filled" : "queue-slot"}
        >
          {item ? item.label.slice(0, 1) : ""}
        </div>
      ))}
    </div>
  );
}

export function RallyReadout({ x, z }: { x?: number; z?: number }) {
  if (x === undefined || z === undefined) return null;
  const label = `${formatCoord(x)}, ${formatCoord(z)}`;
  return (
    <p className="rally-readout" aria-label={`진출 ${label}`}>
      <span>{label}</span>
    </p>
  );
}

export function CostLine({ energy, minerals }: { energy: number; minerals: number }) {
  return (
    <p className="cost-line">
      <IconEnergy size={14} />
      <span>{energy}</span>
      <IconMineral size={14} />
      <span>{minerals}</span>
    </p>
  );
}

export function ScreenFill({
  children,
  center = false,
}: {
  children: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={center ? "screen-fill is-center" : "screen-fill"}>{children}</div>
  );
}
