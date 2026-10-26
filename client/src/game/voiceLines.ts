import type { RaceId } from "../protocol";

/** 자원이 부족할 때 전장에 띄우는 부관 문구. */

export type AdvisorCue = "minerals" | "ether" | "supply";

export interface VoiceLine {
  id: string;
  text: string;
}

function line(id: string, text: string): VoiceLine {
  return { id, text };
}

const ADVISOR: Record<RaceId, Record<AdvisorCue, readonly VoiceLine[]>> = {
  human: {
    minerals: [line("human/advisor/minerals/1", "미네랄이 부족합니다.")],
    ether: [line("human/advisor/ether/1", "에테르가 부족합니다.")],
    supply: [line("human/advisor/supply/2", "보급창고가 더 필요합니다.")],
  },
  monster: {
    minerals: [line("monster/advisor/minerals/1", "미네랄이 없다.")],
    ether: [line("monster/advisor/ether/1", "에테르가 없다.")],
    supply: [line("monster/advisor/supply/2", "관측체가 더 필요하다.")],
  },
  alien: {
    minerals: [line("alien/advisor/minerals/1", "미네랄이 부족하다.")],
    ether: [line("alien/advisor/ether/1", "에테르가 부족하다.")],
    supply: [line("alien/advisor/supply/3", "더 이상 소환할 수 없다.")],
  },
};

export function advisorVoiceLines(
  race: RaceId,
  cue: AdvisorCue,
): readonly VoiceLine[] {
  return ADVISOR[race][cue];
}
