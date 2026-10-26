import type { RaceId } from "../protocol";
import { showAdvisorNotice } from "./advisorNotice";
import { advisorVoiceLines, type AdvisorCue } from "./voiceLines";

/** 자원이 부족하면 부관 문구를 전장에 띄운다. */
export function speakAdvisor(race: RaceId, cue: AdvisorCue): void {
  const lines = advisorVoiceLines(race, cue);
  if (lines.length === 0) return;
  const line = lines[Math.floor(Math.random() * lines.length)];
  showAdvisorNotice(line.text);
}
