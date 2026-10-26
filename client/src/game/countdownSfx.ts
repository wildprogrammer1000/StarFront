import {
  playEngineClip,
  preloadEngineAudio,
  setEngineClipVolume,
  stopEngineClip,
} from "./engineAudio";
import { sfxGain, subscribeSoundSettings } from "./soundSettings";

let lastStep: number | null = null;

/** 대기실이 열리면 엔진 사운드를 받아 두어 첫 틱이 늦지 않게 한다. */
export function preloadCountdownTick(): void {
  preloadEngineAudio();
}

/** 이번 카운트다운에서 이미 튼 숫자를 잊는다. */
export function armCountdownTicks(): void {
  lastStep = null;
}

/**
 * 카운트 숫자가 바뀔 때 한 번.
 * step 을 주면 같은 숫자는 다시 틀지 않는다. 미리듣기는 step 없이 호출한다.
 */
export function playCountdownTick(step?: number): void {
  const gain = sfxGain();
  if (gain <= 0) return;
  if (typeof step === "number") {
    if (step === lastStep) return;
    lastStep = step;
  }
  setEngineClipVolume("countdown", gain);
  playEngineClip("countdown");
}

export function stopCountdownTick(): void {
  lastStep = null;
  stopEngineClip("countdown");
}

/** 카운트다운이 끝나고 전투가 시작될 때 한 번. */
export function playGameStart(): void {
  const gain = sfxGain();
  stopCountdownTick();
  if (gain <= 0) return;
  setEngineClipVolume("gamestart", gain);
  playEngineClip("gamestart");
}

subscribeSoundSettings(() => {
  const gain = sfxGain();
  if (gain <= 0) {
    stopEngineClip("countdown");
    stopEngineClip("gamestart");
    return;
  }
  setEngineClipVolume("countdown", gain);
  setEngineClipVolume("gamestart", gain);
});
