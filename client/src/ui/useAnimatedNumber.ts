import { useEffect, useRef, useState } from "react";
import { roundResource } from "./format";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 목표값이 바뀌면 현재 표시값에서 목표까지 카운트 보간.
 * durationMs 동안 ease-out, 중간에 목표가 바뀌면 현재 표시값부터 재시작.
 */
export function useAnimatedNumber(
  target: number,
  durationMs = 480
): { value: number; dir: "up" | "down" | null } {
  const goal = roundResource(target);
  const [value, setValue] = useState(goal);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const valueRef = useRef(goal);
  const rafRef = useRef(0);
  const flashRef = useRef(0);

  useEffect(() => {
    const from = valueRef.current;
    if (from === goal) return;

    const nextDir = goal > from ? "up" : "down";
    setDir(nextDir);
    window.clearTimeout(flashRef.current);
    flashRef.current = window.setTimeout(() => setDir(null), durationMs + 120);

    const started = performance.now();
    const delta = goal - from;
    // 큰 변화도 비슷하게 끝나게 하되, 아주 작은 틱은 짧게
    const span = Math.min(durationMs, Math.max(220, durationMs * (Math.min(Math.abs(delta), 80) / 80)));

    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / span);
      const next = roundResource(from + delta * easeOutCubic(t));
      valueRef.current = next;
      setValue(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        valueRef.current = goal;
        setValue(goal);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [goal, durationMs]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(flashRef.current);
    };
  }, []);

  return { value, dir };
}
