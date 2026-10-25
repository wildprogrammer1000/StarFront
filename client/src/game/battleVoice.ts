import type { EntitySnap, MatchSnapshot, RaceId, Side } from "../protocol";
import { showAdvisorNotice } from "./advisorNotice";
import { speak } from "./voiceSystem";
import {
  advisorVoiceLines,
  RACE_VOICES,
  unitVoice,
  unitVoiceLines,
  type AdvisorCue,
  type UnitVoiceCue,
} from "./voiceLines";

/** 같은 유닛을 이 간격 안에 다시 찍으면 짜증 대사가 쌓인다. */
const ANNOY_GAP_MS = 3000;
/** 이 횟수부터 선택 대사 대신 짜증 대사. */
const ANNOY_AT = 4;

let annoyId = "";
let annoyCount = 0;
let annoyAt = 0;

function sayUnit(typeId: string, cue: UnitVoiceCue): void {
  const voice = unitVoice(typeId);
  if (!voice) return;
  const lines = voice.lines[cue];
  if (!lines || lines.length === 0) return;
  const race = RACE_VOICES[voice.race];
  speak({
    voiceName: race.voiceName,
    pitch: voice.pitch,
    rate: voice.rate,
    lines,
    poolKey: `${typeId}:${cue}`,
    priority: "unit",
  });
}

function speakers(units: readonly EntitySnap[], side: Side | null): EntitySnap[] {
  if (!side) return [];
  const out: EntitySnap[] = [];
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    if (unit.side !== side || unit.hp <= 0) continue;
    if (!unitVoice(unit.typeId)) continue;
    out.push(unit);
  }
  return out;
}

function clearAnnoy(): void {
  annoyId = "";
  annoyCount = 0;
  annoyAt = 0;
}

/** 아군 유닛 하나 또는 묶음을 고를 때. 건물은 말하지 않는다. */
export function speakSelection(units: readonly EntitySnap[], side: Side | null): void {
  const mine = speakers(units, side);
  if (mine.length !== 1) {
    clearAnnoy();
    if (mine.length === 0) return;
    const one = mine[Math.floor(Math.random() * mine.length)];
    sayUnit(one.typeId, "select");
    return;
  }
  const unit = mine[0];
  const now = performance.now();
  if (annoyId === unit.id && now - annoyAt <= ANNOY_GAP_MS) annoyCount += 1;
  else annoyCount = 1;
  annoyId = unit.id;
  annoyAt = now;
  sayUnit(unit.typeId, annoyCount >= ANNOY_AT ? "annoyed" : "select");
}

function isActor(kind: EntitySnap["kind"]): boolean {
  return kind === "unit" || kind === "worker";
}

/**
 * 아군 유닛·일꾼이 생산되면 생산 대사를 말한다.
 * 경기 시작 배치는 첫 스냅샷에서 기억만 하고 말하지 않는다.
 * 몬스터는 알이 같은 id로 유닛이 되므로, 종류가 바뀐 경우도 생산으로 본다.
 * 한 스냅샷에 여러 기가 나와도 한 기만 말한다.
 */
export function speakProducedUnits(
  snap: MatchSnapshot,
  userId: string,
  seen: Map<string, EntitySnap["kind"]>
): void {
  if (snap.status !== "playing") {
    seen.clear();
    return;
  }

  let meSide: Side | null = null;
  for (let i = 0; i < snap.players.length; i++) {
    if (snap.players[i].userId === userId) {
      meSide = snap.players[i].side;
      break;
    }
  }
  if (!meSide) return;

  if (seen.size === 0) {
    for (let i = 0; i < snap.entities.length; i++) {
      const entity = snap.entities[i];
      seen.set(entity.id, entity.kind);
    }
    return;
  }

  const live = new Set<string>();
  const fresh: EntitySnap[] = [];
  for (let i = 0; i < snap.entities.length; i++) {
    const entity = snap.entities[i];
    live.add(entity.id);
    const prev = seen.get(entity.id);
    const born = isActor(entity.kind);
    if (
      entity.side === meSide &&
      born &&
      (prev === undefined || !isActor(prev))
    ) {
      fresh.push(entity);
    }
    seen.set(entity.id, entity.kind);
  }
  for (const id of Array.from(seen.keys())) {
    if (!live.has(id)) seen.delete(id);
  }

  const voices = fresh.filter(
    (entity) => unitVoiceLines(entity.typeId, "produce").length > 0
  );
  if (voices.length === 0) return;
  const one = voices[Math.floor(Math.random() * voices.length)];
  sayUnit(one.typeId, "produce");
}

/** 이동·수확은 move, 공격·공격이동은 attack. 그 대사가 있는 유닛 하나만 말한다. */
export function speakOrder(
  units: readonly EntitySnap[],
  side: Side | null,
  cue: "move" | "attack"
): void {
  clearAnnoy();
  const mine = speakers(units, side).filter(
    (unit) => unitVoiceLines(unit.typeId, cue).length > 0
  );
  if (mine.length === 0) return;
  const one = mine[Math.floor(Math.random() * mine.length)];
  sayUnit(one.typeId, cue);
}

export function speakAdvisor(race: RaceId, cue: AdvisorCue): void {
  const profile = RACE_VOICES[race];
  const text = speak({
    voiceName: profile.voiceName,
    pitch: profile.pitch,
    rate: profile.rate,
    lines: advisorVoiceLines(race, cue),
    poolKey: `${race}:advisor:${cue}`,
    priority: "advisor",
  });
  if (text) showAdvisorNotice(text);
}
