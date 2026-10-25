import { useEffect, useState } from "react";
import {
  getSoundSettings,
  subscribeSoundSettings,
  type SoundSettings,
} from "./soundSettings";

export function useSoundSettings(): SoundSettings {
  const [settings, setSettings] = useState(getSoundSettings);
  useEffect(
    () => subscribeSoundSettings(() => setSettings(getSoundSettings())),
    []
  );
  return settings;
}
