import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PlayerSnap, Side } from "../protocol";
import { Button } from "../ui/controls";
import { formatPlayTime, roundResource } from "../ui/format";
import { IconGas, IconMineral, IconSupply } from "../ui/icons";
import { raceOf } from "../ui/races";

interface Props {
  me?: PlayerSnap;
  enemy?: PlayerSnap;
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

const STAT_COLS: {
  key: keyof PlayerSnap;
  word: string;
  label: string;
  Icon: typeof IconMineral;
}[] = [
  { key: "mineralsGained", word: "획득", label: "미네랄 획득", Icon: IconMineral },
  { key: "mineralsSpent", word: "사용", label: "미네랄 사용", Icon: IconMineral },
  { key: "etherGained", word: "획득", label: "에테르 획득", Icon: IconGas },
  { key: "etherSpent", word: "사용", label: "에테르 사용", Icon: IconGas },
  { key: "unitsMade", word: "생산", label: "유닛 생산", Icon: IconSupply },
];

function sideLabel(player: PlayerSnap | undefined, fallback: string): string {
  if (!player) return fallback;
  const name = (player.displayName || "").trim();
  if (name) return name;
  return raceOf(player.race).name;
}

function statValue(player: PlayerSnap | undefined, key: keyof PlayerSnap): string {
  if (!player) return "—";
  const value = player[key];
  return String(roundResource(typeof value === "number" ? value : 0));
}

export function ResultScreen({
  me,
  enemy,
  winnerSide,
  playSec,
  onLobby,
}: Props) {
  const result = outcome(me, winnerSide);
  const copy = COPY[result];
  const meName = sideLabel(me, "아군");
  const enemyName = sideLabel(enemy, "적");
  const [host, setHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setHost(document.querySelector<HTMLElement>(".stage.scene-game"));
  }, []);

  useLayoutEffect(() => {
    if (!host) return;
    const canvas = host.querySelector<HTMLElement>(".stage-canvas-view");
    const overlay = host.querySelector<HTMLElement>(".result-overlay");
    if (!canvas || !overlay) return;
    const apply = () => {
      const stageBox = host.getBoundingClientRect();
      const canvasBox = canvas.getBoundingClientRect();
      overlay.style.left = `${canvasBox.left - stageBox.left}px`;
      overlay.style.width = `${canvasBox.width}px`;
      overlay.style.height = "100%";
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(canvas);
    ro.observe(host);
    return () => ro.disconnect();
  }, [host]);

  const overlay = (
    <div
      className="result-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-verdict"
    >
      <div className={`result-panel${result === "loss" ? " is-loss" : ""}`}>
        <div className="result-body">
          <h2
            id="result-verdict"
            className={result === "loss" ? "verdict is-loss" : "verdict"}
          >
            {copy}
          </h2>
          <div className="result-stats-block">
          <table className="result-stats">
            <caption className="sr-only">전투 통계</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">플레이어</span>
                </th>
                {STAT_COLS.map((col) => (
                  <th key={col.key} scope="col">
                    <span className="result-stat-label" aria-label={col.label}>
                      <col.Icon size={14} />
                      <span aria-hidden="true">{col.word}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { id: "me", name: meName, player: me },
                { id: "enemy", name: enemyName, player: enemy },
              ].map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.name}</th>
                  {STAT_COLS.map((col) => (
                    <td key={col.key}>{statValue(row.player, col.key)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="result-time">플레이 타임 {formatPlayTime(playSec ?? 0)}</p>
          </div>
        </div>
        <Button variant="primary" block onClick={onLobby}>
          로비
        </Button>
      </div>
    </div>
  );

  if (!host) return overlay;
  return createPortal(overlay, host);
}
