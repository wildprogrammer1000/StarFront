import type { EntitySnap, PlayerSnap, Side } from "../protocol";
import { Button } from "../ui/controls";
import { formatPlayTime, roundResource } from "../ui/format";
import { IconEnergy, IconMineral, IconSupply } from "../ui/icons";
import { raceOf } from "../ui/races";
import { HpBar } from "../ui/widgets";

interface Props {
  me?: PlayerSnap;
  enemy?: PlayerSnap;
  entities: EntitySnap[];
  winnerSide?: Side | "draw";
  playSec?: number;
  onLobby: () => void;
}

function outcome(
  me: PlayerSnap | undefined,
  winnerSide?: Side | "draw"
): "win" | "loss" | "draw" {
  if (!winnerSide || winnerSide === "draw" || !me) return "draw";
  return winnerSide === me.side ? "win" : "loss";
}

const COPY = {
  win: "승리",
  loss: "패배",
  draw: "무승부",
} as const;

export function ResultScreen({
  me,
  enemy,
  entities,
  winnerSide,
  playSec,
  onLobby,
}: Props) {
  const result = outcome(me, winnerSide);
  const copy = COPY[result];
  const ally = raceOf(me?.race);
  const foe = raceOf(enemy?.race);
  const allyHq = entities.find((e) => me && e.kind === "hq" && e.side === me.side);
  const enemyHq = entities.find((e) => me && e.kind === "hq" && e.side !== me.side);
  const alive = entities.filter(
    (e) => me && e.side === me.side && (e.kind === "unit" || e.kind === "worker")
  ).length;

  return (
    <div
      className="result-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-verdict"
    >
      <div className={`result-panel${result === "loss" ? " is-loss" : ""}`}>
        <h2
          id="result-verdict"
          className={result === "loss" ? "verdict is-loss" : "verdict"}
        >
          {copy}
        </h2>
        <p className="result-time">플레이 타임 {formatPlayTime(playSec ?? 0)}</p>
        <HpBar
          tone="ally"
          label={ally.hq}
          hp={allyHq?.hp ?? 0}
          maxHp={allyHq?.maxHp || 1}
        />
        <HpBar
          tone="enemy"
          label={foe.hq}
          hp={enemyHq?.hp ?? 0}
          maxHp={enemyHq?.maxHp || 1}
        />
        <div className="stat-row">
          <span className="stat-icon" aria-label={`에테르 ${me ? roundResource(me.energy) : 0}`}>
            <IconEnergy size={14} />
            <strong>{me ? roundResource(me.energy) : "—"}</strong>
          </span>
          <span className="stat-icon" aria-label={`미네랄 ${me ? roundResource(me.minerals) : 0}`}>
            <IconMineral size={14} />
            <strong>{me ? roundResource(me.minerals) : "—"}</strong>
          </span>
          <span className="stat-icon" aria-label={`생존 ${alive}`}>
            <IconSupply size={14} />
            <strong>{alive}</strong>
          </span>
        </div>
        <Button variant="primary" block onClick={onLobby}>
          로비
        </Button>
      </div>
    </div>
  );
}
