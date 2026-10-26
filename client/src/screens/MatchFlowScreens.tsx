import { useCallback, useEffect, useState } from "react";
import {
  armCountdownTicks,
  playCountdownTick,
  preloadCountdownTick,
  stopCountdownTick,
} from "../game/countdownSfx";
import { preloadBattleBgm } from "../game/battleBgm";
import type { BotDifficulty } from "@shared/sim/bot";
import type { PlayerSnap, RaceId } from "../protocol";
import { Button, MetalSelect } from "../ui/controls";
import { IconCopy, IconShare } from "../ui/icons";
import { RACE_ORDER, RACES } from "../ui/races";
import { ScreenFill } from "../ui/widgets";

const RACE_OPTIONS = RACE_ORDER.map((id) => ({
  value: id,
  label: RACES[id].name,
}));

const DIFFICULTY_OPTIONS: { value: BotDifficulty; label: string }[] = [
  { value: "easy", label: "쉬움" },
  { value: "normal", label: "보통" },
  { value: "hard", label: "어려움" },
];

/** 로컬 AI 플레이어. shared/sim/bot.ts 와 같다. */
const BOT_USER_ID = "bot";

export function MatchingScreen({
  phase,
  onCancel,
}: {
  phase: "search" | "join";
  onCancel: () => void;
}) {
  return (
    <ScreenFill center>
      <div className="stack">
        <div className="radar" aria-hidden="true" />
        <p className="frame-title">
          {phase === "search" ? "빈 방 찾는 중" : "입장"}
        </p>
        <Button variant="ghost" block onClick={onCancel}>
          취소
        </Button>
      </div>
    </ScreenFill>
  );
}

/** 대기실 — 방 정보·슬롯·종족·방장 시작 */
export function WaitingScreen({
  roomName,
  inviteCode,
  players,
  hostUserId,
  localUserId,
  race,
  onRace,
  onBotRace,
  onBotDifficulty,
  countdown,
  canStart,
  onStart,
  onLeave,
}: {
  roomName?: string;
  inviteCode?: string;
  players: PlayerSnap[];
  hostUserId?: string;
  localUserId?: string;
  race: RaceId;
  onRace: (race: RaceId) => void;
  onBotRace?: (race: RaceId) => void;
  onBotDifficulty?: (id: BotDifficulty) => void;
  countdown?: number;
  canStart: boolean;
  onStart: () => void;
  onLeave: () => void;
}) {
  const isHost = !!localUserId && localUserId === hostUserId;
  const slots = [0, 1].map((i) => players[i] ?? null);
  const counting =
    typeof countdown === "number"
      ? countdown > 0
      : false;
  const [copied, setCopied] = useState(false);
  const [difficulty, setDifficulty] = useState<BotDifficulty>("normal");
  const [botRacePick, setBotRacePick] = useState<RaceId | null>(null);
  const botPlayer = players.find((p) => p.userId === BOT_USER_ID);
  useEffect(() => {
    if (botRacePick && botPlayer?.race === botRacePick) setBotRacePick(null);
  }, [botPlayer?.race, botRacePick]);

  useEffect(() => {
    armCountdownTicks();
    preloadCountdownTick();
    preloadBattleBgm();
    return () => stopCountdownTick();
  }, []);

  useEffect(() => {
    if (!counting || typeof countdown !== "number") return;
    playCountdownTick(countdown);
  }, [counting, countdown]);

  const copyInvite = useCallback(async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }, [inviteCode]);

  const shareInvite = useCallback(async () => {
    if (!inviteCode) return;
    const title = roomName || "전선";
    const text = `${title} 초대 코드: ${inviteCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore cancel */
    }
  }, [inviteCode, roomName]);

  return (
    <ScreenFill>
      {counting ? null : (
        <header className="room-lobby-head">
          <h1 className="room-lobby-title">{roomName || "전선"}</h1>
          {inviteCode ? (
            <div className="invite-code-row" aria-label="초대 코드">
              <span className="invite-code">{inviteCode}</span>
              <button
                type="button"
                className="invite-icon-btn"
                aria-label={copied ? "복사됨" : "초대 코드 복사"}
                onClick={() => void copyInvite()}
              >
                <IconCopy size={16} />
              </button>
              <button
                type="button"
                className="invite-icon-btn"
                aria-label="초대 코드 공유"
                onClick={() => void shareInvite()}
              >
                <IconShare size={16} />
              </button>
            </div>
          ) : null}
        </header>
      )}

      {counting ? (
        <div className="room-countdown" aria-live="polite">
          <p className="room-countdown-num">{countdown}</p>
          <p className="room-countdown-label">전투 개시</p>
        </div>
      ) : (
        <>
          <section className="room-slots" aria-label="플레이어">
            <h2 className="room-slots-title">플레이어</h2>
            {slots.map((p, i) => {
              const empty = !p;
              const host = p && p.userId === hostUserId;
              const self = p && p.userId === localUserId;
              const profile = p ? RACES[p.race] : null;
              const bot = p?.userId === BOT_USER_ID;
              return (
                <div key={i} className="room-slot-row">
                  <div
                    className={
                      empty
                        ? "room-slot is-empty"
                        : self
                          ? "room-slot is-self"
                          : "room-slot"
                    }
                  >
                    <span className="room-slot-pos">{i === 0 ? "1P" : "2P"}</span>
                    {empty ? (
                      <span className="room-slot-name">대기 중…</span>
                    ) : (
                      <span className="room-slot-name">
                        {p.displayName?.trim() ||
                          (self ? "나" : `지휘관 ${i + 1}`)}
                        {host ? " · 방장" : ""}
                      </span>
                    )}
                  </div>
                  <div className="room-slot-race-col">
                    {empty ? (
                      <span className="room-slot-race is-muted">—</span>
                    ) : self ? (
                      <MetalSelect
                        className="race-select-wrap"
                        label="종족 선택"
                        value={race}
                        options={RACE_OPTIONS}
                        onChange={onRace}
                      />
                    ) : bot && onBotRace ? (
                      <MetalSelect
                        className="race-select-wrap"
                        label="컴퓨터 종족"
                        value={botRacePick ?? p.race}
                        options={RACE_OPTIONS}
                        onChange={(next) => {
                          setBotRacePick(next);
                          onBotRace(next);
                        }}
                      />
                    ) : (
                      <span className="room-slot-race">{profile?.name}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          <div className="room-lobby-actions">
            {onBotDifficulty ? (
              <MetalSelect
                className="race-select-wrap"
                label="난이도"
                value={difficulty}
                options={DIFFICULTY_OPTIONS}
                onChange={(next) => {
                  setDifficulty(next);
                  onBotDifficulty(next);
                }}
              />
            ) : null}
            {isHost ? (
              <Button
                variant="primary"
                block
                className="battle-quick"
                disabled={!canStart}
                onClick={onStart}
              >
                게임 시작
              </Button>
            ) : (
              <p className="room-host-wait">방장의 시작을 기다리는 중</p>
            )}
            <Button variant="danger" block onClick={onLeave}>
              나가기
            </Button>
          </div>
        </>
      )}
    </ScreenFill>
  );
}
