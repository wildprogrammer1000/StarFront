import type {
  Mouse as PlayCanvasMouse,
  MouseEvent as PlayCanvasMouseEvent,
  TouchDevice as PlayCanvasTouchDevice,
  TouchEvent as PlayCanvasTouchEvent,
} from "playcanvas";

/**
 * 전장 포인터.
 * 터치 기기에서는 touch* 만, 그 외에는 mouse* 만 연다.
 * 한 탭이 터치와 마우스 호환 이벤트로 두 번 들어오면
 * 두 번째 입력이 패닝·선택으로 처리되며 공격 지정이 풀린다.
 */
export interface SurfacePoint {
  id: number;
  clientX: number;
  clientY: number;
  /** 0 좌클릭·터치, 1 휠, 2 우클릭 */
  button: number;
  /** MouseEvent.buttons. 접촉 중인 터치는 1 */
  buttons: number;
  kind: "mouse" | "touch";
  pressure: number;
  target: EventTarget | null;
  preventDefault: () => void;
  stopPropagation: () => void;
}

export interface SurfaceHandlers {
  down: (point: SurfacePoint) => void;
  move: (point: SurfacePoint) => void;
  up: (point: SurfacePoint) => void;
  cancel: (point: SurfacePoint) => void;
}

const MOUSE_ID = 1;

export function deviceUsesTouch(): boolean {
  return typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
}

function fromTouch(ev: TouchEvent, touch: Touch, pressed: boolean): SurfacePoint {
  return {
    id: touch.identifier,
    clientX: touch.clientX,
    clientY: touch.clientY,
    button: 0,
    buttons: pressed ? 1 : 0,
    kind: "touch",
    pressure: touch.force > 0 ? touch.force : pressed ? 0.5 : 0,
    target: ev.target,
    preventDefault: () => {
      if (ev.cancelable) ev.preventDefault();
    },
    stopPropagation: () => ev.stopPropagation(),
  };
}

function fromMouse(ev: MouseEvent, pressed: boolean): SurfacePoint {
  return {
    id: MOUSE_ID,
    clientX: ev.clientX,
    clientY: ev.clientY,
    button: ev.button,
    buttons: pressed ? ev.buttons : 0,
    kind: "mouse",
    pressure: pressed && (ev.buttons & 1) !== 0 ? 0.5 : 0,
    target: ev.target,
    preventDefault: () => ev.preventDefault(),
    stopPropagation: () => ev.stopPropagation(),
  };
}

function fromPlayCanvasMouse(
  ev: PlayCanvasMouseEvent,
  pressed: boolean
): SurfacePoint {
  const source = ev.event;
  const buttons =
    (ev.buttons[0] ? 1 : 0) |
    (ev.buttons[1] ? 4 : 0) |
    (ev.buttons[2] ? 2 : 0);
  return {
    id: MOUSE_ID,
    clientX: source.clientX,
    clientY: source.clientY,
    button: ev.button,
    buttons: pressed ? buttons : 0,
    kind: "mouse",
    pressure: pressed && ev.buttons[0] ? 0.5 : 0,
    target: source.target,
    preventDefault: () => source.preventDefault(),
    stopPropagation: () => source.stopPropagation(),
  };
}

function fromPlayCanvasTouch(
  ev: PlayCanvasTouchEvent,
  touch: PlayCanvasTouchEvent["changedTouches"][number],
  pressed: boolean
): SurfacePoint {
  const source = ev.event;
  return {
    id: touch.id,
    clientX: touch.touch.clientX,
    clientY: touch.touch.clientY,
    button: 0,
    buttons: pressed ? 1 : 0,
    kind: "touch",
    pressure: touch.touch.force > 0 ? touch.touch.force : pressed ? 0.5 : 0,
    target: touch.target,
    preventDefault: () => {
      if (source.cancelable) source.preventDefault();
    },
    stopPropagation: () => source.stopPropagation(),
  };
}

function bindTouch(el: HTMLElement, handlers: SurfaceHandlers): () => void {
  const start = (ev: TouchEvent) => {
    for (let i = 0; i < ev.changedTouches.length; i++) {
      handlers.down(fromTouch(ev, ev.changedTouches[i], true));
    }
  };
  const move = (ev: TouchEvent) => {
    for (let i = 0; i < ev.changedTouches.length; i++) {
      handlers.move(fromTouch(ev, ev.changedTouches[i], true));
    }
  };
  const end = (ev: TouchEvent) => {
    for (let i = 0; i < ev.changedTouches.length; i++) {
      handlers.up(fromTouch(ev, ev.changedTouches[i], false));
    }
  };
  const cancel = (ev: TouchEvent) => {
    for (let i = 0; i < ev.changedTouches.length; i++) {
      handlers.cancel(fromTouch(ev, ev.changedTouches[i], false));
    }
  };
  // 캡처로 받아 캔버스 자식이 터치를 삼키기 전에 명령을 확정한다.
  const opts: AddEventListenerOptions = { passive: false, capture: true };
  el.addEventListener("touchstart", start, opts);
  el.addEventListener("touchmove", move, opts);
  el.addEventListener("touchend", end, opts);
  el.addEventListener("touchcancel", cancel, opts);
  return () => {
    el.removeEventListener("touchstart", start, opts);
    el.removeEventListener("touchmove", move, opts);
    el.removeEventListener("touchend", end, opts);
    el.removeEventListener("touchcancel", cancel, opts);
  };
}

function bindMouse(el: HTMLElement, handlers: SurfaceHandlers): () => void {
  const down = (ev: MouseEvent) => {
    handlers.down(fromMouse(ev, true));
  };
  const move = (ev: MouseEvent) => {
    if (ev.buttons === 0) return;
    handlers.move(fromMouse(ev, true));
  };
  const up = (ev: MouseEvent) => {
    handlers.up(fromMouse(ev, false));
  };
  const opts: AddEventListenerOptions = { capture: true };
  el.addEventListener("mousedown", down, opts);
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
  return () => {
    el.removeEventListener("mousedown", down, opts);
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
  };
}

/** mousedown↔touchstart, mousemove↔touchmove, mouseup↔touchend */
export function bindSurfaceInput(
  el: HTMLElement,
  handlers: SurfaceHandlers
): () => void {
  return deviceUsesTouch() ? bindTouch(el, handlers) : bindMouse(el, handlers);
}

/** PlayCanvas 앱이 소유한 입력 장치를 게임 입력으로 변환한다. */
export function bindPlayCanvasInput(
  mouse: PlayCanvasMouse,
  touch: PlayCanvasTouchDevice,
  handlers: SurfaceHandlers
): () => void {
  if (deviceUsesTouch()) {
    const start = (ev: PlayCanvasTouchEvent) => {
      for (let i = 0; i < ev.changedTouches.length; i++) {
        handlers.down(fromPlayCanvasTouch(ev, ev.changedTouches[i], true));
      }
    };
    const move = (ev: PlayCanvasTouchEvent) => {
      for (let i = 0; i < ev.changedTouches.length; i++) {
        handlers.move(fromPlayCanvasTouch(ev, ev.changedTouches[i], true));
      }
    };
    const end = (ev: PlayCanvasTouchEvent) => {
      for (let i = 0; i < ev.changedTouches.length; i++) {
        handlers.up(fromPlayCanvasTouch(ev, ev.changedTouches[i], false));
      }
    };
    const cancel = (ev: PlayCanvasTouchEvent) => {
      for (let i = 0; i < ev.changedTouches.length; i++) {
        handlers.cancel(fromPlayCanvasTouch(ev, ev.changedTouches[i], false));
      }
    };
    touch.on("touchstart", start);
    touch.on("touchmove", move);
    touch.on("touchend", end);
    touch.on("touchcancel", cancel);
    return () => {
      touch.off("touchstart", start);
      touch.off("touchmove", move);
      touch.off("touchend", end);
      touch.off("touchcancel", cancel);
    };
  }

  const down = (ev: PlayCanvasMouseEvent) => {
    handlers.down(fromPlayCanvasMouse(ev, true));
  };
  const move = (ev: PlayCanvasMouseEvent) => {
    if (!ev.buttons.some(Boolean)) return;
    handlers.move(fromPlayCanvasMouse(ev, true));
  };
  const up = (ev: PlayCanvasMouseEvent) => {
    handlers.up(fromPlayCanvasMouse(ev, false));
  };
  mouse.on("mousedown", down);
  mouse.on("mousemove", move);
  mouse.on("mouseup", up);
  return () => {
    mouse.off("mousedown", down);
    mouse.off("mousemove", move);
    mouse.off("mouseup", up);
  };
}
