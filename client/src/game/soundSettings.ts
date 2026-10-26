export interface SoundSettings {
  sfxOn: boolean;
  sfxVolume: number;
  bgmOn: boolean;
  bgmVolume: number;
}

const STORAGE_KEY = "starfront_sound";
const LEGACY_SFX_KEY = "starfront_sfx";

const listeners = new Set<() => void>();

function clamp01(n: unknown): number {
  if (typeof n !== "number" || n !== n) return 1;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function readStored(): SoundSettings {
  const base: SoundSettings = {
    sfxOn: true,
    sfxVolume: 1,
    bgmOn: true,
    bgmVolume: 0.6,
  };
  if (typeof localStorage === "undefined") return base;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SoundSettings>;
      return {
        sfxOn: parsed.sfxOn !== false,
        sfxVolume: clamp01(parsed.sfxVolume ?? 1),
        bgmOn: parsed.bgmOn !== false,
        bgmVolume:
          parsed.bgmVolume === undefined ? 0.6 : clamp01(parsed.bgmVolume),
      };
    }
    if (localStorage.getItem(LEGACY_SFX_KEY) === "0") base.sfxOn = false;
  } catch {
    /* 깨진 저장값은 기본값 */
  }
  return base;
}

let current = readStored();

function copySettings(): SoundSettings {
  return {
    sfxOn: current.sfxOn,
    sfxVolume: current.sfxVolume,
    bgmOn: current.bgmOn,
    bgmVolume: current.bgmVolume,
  };
}

export function getSoundSettings(): SoundSettings {
  return copySettings();
}

/** 효과음 재생 크기. 끄면 0. */
export function sfxGain(): number {
  return current.sfxOn ? current.sfxVolume : 0;
}

/** 배경음 재생 크기. 끄면 0. */
export function bgmGain(): number {
  return current.bgmOn ? current.bgmVolume : 0;
}

export function updateSoundSettings(patch: Partial<SoundSettings>): void {
  current = {
    sfxOn: patch.sfxOn !== undefined ? patch.sfxOn : current.sfxOn,
    sfxVolume:
      patch.sfxVolume !== undefined ? clamp01(patch.sfxVolume) : current.sfxVolume,
    bgmOn: patch.bgmOn !== undefined ? patch.bgmOn : current.bgmOn,
    bgmVolume:
      patch.bgmVolume !== undefined ? clamp01(patch.bgmVolume) : current.bgmVolume,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* 저장을 막은 환경 */
  }
  listeners.forEach((fn) => fn());
}

export function subscribeSoundSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
