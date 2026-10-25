import { sfxGain, subscribeSoundSettings } from "./soundSettings";

function makeClip(src: string): {
  preload: () => void;
  play: () => void;
  stop: () => void;
  setVolume: (gain: number) => void;
} {
  let audio: HTMLAudioElement | null = null;
  const node = (): HTMLAudioElement | null => {
    if (typeof Audio === "undefined") return null;
    if (!audio) {
      audio = new Audio(src);
      audio.preload = "auto";
    }
    return audio;
  };
  return {
    preload: () => node()?.load(),
    play: () => {
      const gain = sfxGain();
      if (gain <= 0) return;
      const clip = node();
      if (!clip) return;
      clip.volume = gain;
      clip.currentTime = 0;
      void clip.play().catch(() => undefined);
    },
    stop: () => {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
    },
    setVolume: (gain: number) => {
      if (audio) audio.volume = gain;
    },
  };
}

const countdownTick = makeClip("/sfx/countdown.ogg");
const gameStart = makeClip("/sfx/gamestart.ogg");

/** 대기실이 열리면 받아 두어 첫 틱이 늦지 않게 한다. */
export function preloadCountdownTick(): void {
  countdownTick.preload();
  gameStart.preload();
}

/** 카운트 숫자가 바뀔 때마다 한 번. 효과음을 끄면 재생하지 않는다. */
export function playCountdownTick(): void {
  countdownTick.play();
}

export function stopCountdownTick(): void {
  countdownTick.stop();
}

/** 카운트다운이 끝나고 전투가 시작될 때 한 번. */
export function playGameStart(): void {
  countdownTick.stop();
  gameStart.play();
}

subscribeSoundSettings(() => {
  const gain = sfxGain();
  if (gain <= 0) {
    countdownTick.stop();
    gameStart.stop();
    return;
  }
  countdownTick.setVolume(gain);
  gameStart.setVolume(gain);
});
