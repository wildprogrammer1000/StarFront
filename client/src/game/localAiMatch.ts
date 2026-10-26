import type { MatchSnapshot, PlayerInput, RaceId } from "@shared/protocol";
import { BOT_USER_ID, thinkTicksFor, type BotDifficulty } from "@shared/sim/bot";
import { TICK_DT } from "@shared/sim/constants";
import { createMatchSim } from "@shared/sim/MatchSim";

export const LOCAL_AI_MATCH_ID = "local-ai";

export type LocalAiMatch = {
  matchId: string;
  userId: string;
  send: (input: PlayerInput) => void;
  setDifficulty: (id: BotDifficulty) => void;
  stop: () => void;
};

/**
 * 컴퓨터 대전. 서버 왕복 없이 같은 시뮬을 브라우저에서 돌리고,
 * 입력은 받는 즉시 스냅샷에 반영한다.
 */
export function startLocalAiMatch(opts: {
  userId: string;
  displayName: string;
  race: RaceId;
  onSnapshot: (snap: MatchSnapshot) => void;
}): LocalAiMatch {
  const sim = createMatchSim({
    hostUserId: opts.userId,
    roomName: "AI 대전",
    inviteCode: "",
  });
  sim.addPlayer(opts.userId, "local", "bottom", opts.displayName);
  sim.botThinkTicks = thinkTicksFor("normal");
  sim.addPlayer(BOT_USER_ID, "", "top", "컴퓨터");
  sim.applyInput(opts.userId, { type: "set_race", race: opts.race });

  let stopped = false;
  let raf = 0;
  let acc = 0;
  let last = performance.now();

  function publish(): void {
    opts.onSnapshot(sim.snapshot());
  }

  function frame(now: number): void {
    if (stopped) return;
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += dt;
    let stepped = false;
    while (acc >= TICK_DT) {
      sim.step();
      acc -= TICK_DT;
      stepped = true;
      if (sim.status === "ended") break;
    }
    if (stepped) publish();
    if (!stopped && sim.status !== "ended") {
      raf = requestAnimationFrame(frame);
    }
  }

  function send(input: PlayerInput): void {
    if (stopped) return;
    if (input.type === "set_bot_race") {
      const bot = sim.players[BOT_USER_ID];
      const race = input.race;
      if (
        sim.status === "waiting" &&
        bot &&
        (race === "human" || race === "monster" || race === "alien")
      ) {
        bot.race = race;
      }
    } else if (input.type === "host_start") {
      sim.beginCountdown();
    } else {
      sim.applyInput(opts.userId, input);
    }
    publish();
  }

  publish();
  raf = requestAnimationFrame(frame);

  return {
    matchId: LOCAL_AI_MATCH_ID,
    userId: opts.userId,
    send,
    setDifficulty(id) {
      sim.botThinkTicks = thinkTicksFor(id);
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
    },
  };
}
