import { subscribeSoundSettings, voiceGain } from "./soundSettings";
import { VOICE_LANG, type VoiceLine } from "./voiceLines";

/** unit 은 부관이 말하는 동안 나오지 않는다. advisor 는 유닛 대사를 끊지만, 이미 재생 중이면 다시 시작하지 않는다. */
export type VoicePriority = "unit" | "advisor";

export interface SpeakRequest {
  /** SpeechSynthesisVoice.name */
  voiceName: string;
  lines: readonly VoiceLine[];
  pitch?: number;
  rate?: number;
  /** 같은 묶음에서 직전 문장은 피한다. */
  poolKey?: string;
  priority?: VoicePriority;
}

const lastLineId = new Map<string, string>();
let generation = 0;
let advisorSpeaking = false;

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  return window.speechSynthesis;
}

function findVoice(name: string): SpeechSynthesisVoice | null {
  const voices = synth()?.getVoices() ?? [];
  for (let i = 0; i < voices.length; i++) {
    if (voices[i].name === name) return voices[i];
  }
  const hits: SpeechSynthesisVoice[] = [];
  for (let i = 0; i < voices.length; i++) {
    const voice = voices[i];
    if (voice.name.startsWith(`${name} `) || voice.name.startsWith(`${name}(`)) hits.push(voice);
  }
  for (let i = 0; i < hits.length; i++) {
    if (hits[i].lang === VOICE_LANG || hits[i].lang.startsWith("ko")) return hits[i];
  }
  return hits[0] ?? null;
}

function pickLine(poolKey: string, lines: readonly VoiceLine[]): VoiceLine {
  const last = lastLineId.get(poolKey);
  const choices = lines.length > 1 ? lines.filter((line) => line.id !== last) : lines;
  const line = choices[Math.floor(Math.random() * choices.length)] ?? lines[0];
  lastLineId.set(poolKey, line.id);
  return line;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    window.speechSynthesis.getVoices();
  });
}

/** 한 번에 한 줄. 고른 문장을 돌려준다. 음성 장치가 없어도 문장은 고른다. */
export function speak(request: SpeakRequest): string | null {
  if (request.lines.length === 0) return null;
  const priority = request.priority ?? "unit";
  const gain = voiceGain();
  if (priority === "unit" && gain <= 0) return null;
  if (advisorSpeaking) return null;

  const line = pickLine(request.poolKey ?? request.voiceName, request.lines);
  const speech = synth();
  if (!speech || gain <= 0) return line.text;

  const gen = ++generation;
  advisorSpeaking = priority === "advisor";
  speech.cancel();

  window.setTimeout(() => {
    if (gen !== generation) return;
    const utter = new SpeechSynthesisUtterance(line.text);
    utter.lang = VOICE_LANG;
    utter.volume = gain;
    utter.pitch = request.pitch ?? 1;
    utter.rate = request.rate ?? 1;
    const voice = findVoice(request.voiceName);
    if (voice) utter.voice = voice;
    const done = () => {
      if (gen !== generation) return;
      if (priority === "advisor") advisorSpeaking = false;
    };
    utter.onend = done;
    utter.onerror = done;
    speech.speak(utter);
  }, 40);
  return line.text;
}

export function stopSpeaking(): void {
  generation += 1;
  advisorSpeaking = false;
  synth()?.cancel();
}

/** 설정 탭에서 음성 크기를 확인할 때. */
export function previewVoice(): void {
  if (voiceGain() <= 0) return;
  stopSpeaking();
  speak({
    voiceName: "Reed",
    lines: [{ id: "sound-preview", text: "음성 확인" }],
    poolKey: "sound-preview",
    priority: "unit",
  });
}

subscribeSoundSettings(() => {
  if (voiceGain() <= 0) stopSpeaking();
});
