import * as pc from "playcanvas";

/** 전투 캔버스와 별도로, 로비·카운트다운에서도 같은 엔진 사운드를 튼다. */
const CLIPS = {
  countdown: "/sfx/countdown.ogg",
  gamestart: "/sfx/gamestart.ogg",
  bgm: "/sfx/bgm.mp3",
} as const;

export type EngineClip = keyof typeof CLIPS;

let app: pc.Application | null = null;
let entity: pc.Entity | null = null;
let booted = false;
const loaded = new Set<EngineClip>();
const wanted = new Set<EngineClip>();

function sound(): pc.SoundComponent | null {
  return entity?.sound ?? null;
}

function boot(): void {
  if (booted || typeof document === "undefined") return;
  booted = true;
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1";
  document.body.appendChild(canvas);

  app = new pc.Application(canvas, {
    graphicsDeviceOptions: { alpha: true, antialias: false },
  });
  app.graphicsDevice.maxPixelRatio = 1;
  app.start();

  entity = new pc.Entity("engine-audio");
  entity.addComponent("sound", { volume: 1, positional: false });
  app.root.addChild(entity);

  (Object.keys(CLIPS) as EngineClip[]).forEach((name) => {
    app?.assets.loadFromUrl(CLIPS[name], "audio", (err, asset) => {
      const comp = sound();
      if (err || !asset || !comp) return;
      comp.addSlot(name, {
        asset: asset.id,
        overlap: false,
        loop: name === "bgm",
        volume: 1,
      });
      loaded.add(name);
      if (wanted.has(name)) {
        wanted.delete(name);
        start(name);
      }
    });
  });
}

function resume(): void {
  app?.soundManager.resume();
}

function start(name: EngineClip): void {
  const comp = sound();
  const slot = comp?.slot(name);
  if (!comp || !slot) return;
  resume();
  comp.play(name);
}

export function preloadEngineAudio(): void {
  boot();
}

export function playEngineClip(name: EngineClip): void {
  boot();
  if (!loaded.has(name)) {
    wanted.add(name);
    return;
  }
  start(name);
}

export function stopEngineClip(name: EngineClip): void {
  wanted.delete(name);
  sound()?.stop(name);
}

export function setEngineClipVolume(name: EngineClip, volume: number): void {
  const slot = sound()?.slot(name);
  if (!slot) return;
  slot.volume = volume;
}

export function setEngineClipLoop(name: EngineClip, loop: boolean): void {
  const slot = sound()?.slot(name);
  if (!slot) return;
  slot.loop = loop;
}
