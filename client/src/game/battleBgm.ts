import {
  playEngineClip,
  preloadEngineAudio,
  setEngineClipLoop,
  setEngineClipVolume,
  stopEngineClip,
} from "./engineAudio";
import { bgmGain, subscribeSoundSettings } from "./soundSettings";

const PREVIEW_MS = 2500;

let wanted = false;
let previewTimer = 0;

function applyGain(): number {
  const gain = bgmGain();
  setEngineClipVolume("bgm", gain);
  return gain;
}

/** 대기실에서 받아 두어 전투 시작 직후 바로 나오게 한다. */
export function preloadBattleBgm(): void {
  preloadEngineAudio();
}

/** 전투 중 반복 재생. 이미 나오면 음량만 맞춘다. */
export function startBattleBgm(): void {
  window.clearTimeout(previewTimer);
  wanted = true;
  if (applyGain() <= 0) {
    stopEngineClip("bgm");
    return;
  }
  setEngineClipLoop("bgm", true);
  playEngineClip("bgm");
}

/** 로비·결과로 나가면 멈추고 다음 판은 처음부터 튼다. */
export function stopBattleBgm(): void {
  window.clearTimeout(previewTimer);
  wanted = false;
  stopEngineClip("bgm");
}

/** 설정에서 켜거나 음량을 놓을 때 짧게 들려준다. 전투 중이면 그대로 이어 튼다. */
export function previewBattleBgm(): void {
  if (wanted) {
    if (applyGain() <= 0) stopEngineClip("bgm");
    return;
  }
  if (applyGain() <= 0) {
    stopEngineClip("bgm");
    return;
  }
  setEngineClipLoop("bgm", false);
  playEngineClip("bgm");
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => {
    if (wanted) return;
    stopEngineClip("bgm");
    setEngineClipLoop("bgm", true);
  }, PREVIEW_MS);
}

subscribeSoundSettings(() => {
  if (wanted) {
    if (applyGain() <= 0) stopEngineClip("bgm");
    return;
  }
  if (applyGain() <= 0) stopEngineClip("bgm");
});
