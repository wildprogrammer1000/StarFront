/** 부관 안내 문구. 전장 중앙 하단에 잠깐 보여 준다. */
const NOTICE_MS = 2800;

type Listener = (text: string | null) => void;

let current: string | null = null;
let timer = 0;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => {
    listener(current);
  });
}

export function showAdvisorNotice(text: string): void {
  current = text;
  emit();
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    current = null;
    emit();
  }, NOTICE_MS);
}

export function subscribeAdvisorNotice(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
