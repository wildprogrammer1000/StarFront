import { bgmGain, subscribeSoundSettings } from "./soundSettings";

const SRC = "/sfx/bgm.mp3";
const PREVIEW_MS = 2500;

let audio: HTMLAudioElement | null = null;
let wanted = false;
let previewTimer = 0;

function clip(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!audio) {
    audio = new Audio(SRC);
    audio.preload = "auto";
    audio.loop = true;
  }
  return audio;
}

function sync(): void {
  const node = clip();
  if (!node) return;
  const gain = bgmGain();
  if (!wanted || gain <= 0) {
    node.pause();
    return;
  }
  node.loop = true;
  node.volume = gain;
  if (node.paused) void node.play().catch(() => undefined);
}

/** 대기실에서 받아 두어 전투 시작 직후 바로 나오게 한다. */
export function preloadBattleBgm(): void {
  clip()?.load();
}

/** 전투 중 반복 재생. 이미 나오면 음량만 맞춘다. */
export function startBattleBgm(): void {
  window.clearTimeout(previewTimer);
  wanted = true;
  sync();
}

/** 로비·결과로 나가면 멈추고 다음 판은 처음부터 튼다. */
export function stopBattleBgm(): void {
  window.clearTimeout(previewTimer);
  wanted = false;
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

/** 설정에서 켜거나 음량을 놓을 때 짧게 들려준다. 전투 중이면 그대로 이어 튼다. */
export function previewBattleBgm(): void {
  if (wanted) {
    sync();
    return;
  }
  const node = clip();
  if (!node) return;
  const gain = bgmGain();
  if (gain <= 0) {
    node.pause();
    return;
  }
  node.loop = false;
  node.volume = gain;
  node.currentTime = 0;
  void node.play().catch(() => undefined);
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => {
    if (wanted) return;
    node.pause();
    node.currentTime = 0;
    node.loop = true;
  }, PREVIEW_MS);
}

subscribeSoundSettings(() => {
  if (wanted) {
    sync();
    return;
  }
  if (!audio || audio.paused) return;
  const gain = bgmGain();
  if (gain <= 0) {
    audio.pause();
    return;
  }
  audio.volume = gain;
});
