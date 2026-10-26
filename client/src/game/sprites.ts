/** typeId → 공개 스프라이트 경로. 탑뷰 아이콘, 배경 제거 PNG. */
export const SPRITE_URL: Record<string, string> = {
  human_hq: "/sprites/human_hq.png?v=bldg1",
  human_worker: "/sprites/human_worker.png?v=fix5",
  human_worker_move: "/sprites/human_worker_move.png?v=fix5",
  human_worker_move2: "/sprites/human_worker_move2.png?v=fix5",
  human_barracks: "/sprites/human_barracks.png?v=bldg1",
  human_depot: "/sprites/human_depot.png?v=bldg1",
  human_refinery: "/sprites/human_refinery.png?v=bldg1",
  human_rifleman: "/sprites/human_rifleman.png?v=fix5",
  human_rifleman_move: "/sprites/human_rifleman_move.png?v=fix5",
  human_rifleman_move2: "/sprites/human_rifleman_move2.png?v=fix5",
  human_rifleman_attack: "/sprites/human_rifleman_attack.png?v=atk1",
  human_firebat: "/sprites/human_firebat.png?v=fb3",
  human_firebat_move: "/sprites/human_firebat_move.png?v=fb3",
  human_firebat_move2: "/sprites/human_firebat_move2.png?v=fb3",
  human_firebat_attack: "/sprites/human_firebat_attack.png?v=atk1",
  human_medic: "/sprites/human_medic.png?v=fix5",
  human_medic_move: "/sprites/human_medic_move.png?v=fix5",
  human_medic_move2: "/sprites/human_medic_move2.png?v=fix5",
  human_academy: "/sprites/human_academy.png?v=bldg1",
  monster_hq: "/sprites/monster_hq.png?v=bldg1",
  monster_hatch: "/sprites/monster_hq.png?v=bldg1",
  monster_worker: "/sprites/monster_worker.png?v=fix3",
  monster_worker_move: "/sprites/monster_worker_move.png?v=claw1",
  monster_worker_move2: "/sprites/monster_worker_move2.png?v=claw1",
  monster_hatchery: "/sprites/monster_hatchery.png?v=bldg1",
  monster_hydra_den: "/sprites/monster_hydra_den.png?v=bldg1",
  monster_extractor: "/sprites/monster_extractor.png?v=bldg1",
  monster_blade: "/sprites/monster_blade.png?v=fix3",
  monster_blade_move: "/sprites/monster_blade_move.png?v=fix7",
  monster_blade_move2: "/sprites/monster_blade_move2.png?v=fix3",
  monster_blade_attack: "/sprites/monster_blade_attack.png?v=atk1",
  monster_hydra: "/sprites/monster_hydra.png?v=fix3",
  monster_hydra_move: "/sprites/monster_hydra_move.png?v=fix3",
  monster_hydra_move2: "/sprites/monster_hydra_move2.png?v=fix3",
  monster_hydra_attack: "/sprites/monster_hydra_attack.png?v=atk1",
  monster_sac: "/sprites/monster_sac.png?v=sac1",
  monster_sac_move: "/sprites/monster_sac_move.png?v=sac1",
  monster_sac_move2: "/sprites/monster_sac_move2.png?v=sac1",
  monster_larva: "/sprites/monster_larva.png?v=larva2",
  monster_larva_move: "/sprites/monster_larva_move.png?v=fix3",
  monster_larva_move2: "/sprites/monster_larva_move2.png?v=fix3",
  monster_egg: "/sprites/monster_egg.png?v=egg1",
  alien_hq: "/sprites/alien_hq.png?v=bldg1",
  alien_worker: "/sprites/alien_worker.png?v=fix4",
  alien_worker_move: "/sprites/alien_worker_move.png?v=fix3",
  alien_worker_move2: "/sprites/alien_worker_move2.png?v=fix3",
  alien_gate: "/sprites/alien_gate.png?v=bldg1",
  alien_cyber: "/sprites/alien_cyber.png?v=bldg1",
  alien_pylon: "/sprites/alien_pylon.png?v=pylon2",
  /** 외계인 건물 워프인. 건설 중에 완성 스프라이트 대신 쓴다. */
  alien_warp: "/sprites/alien_warp.png?v=warp2",
  alien_assimilator: "/sprites/alien_assimilator.png?v=bldg1",
  alien_guardian: "/sprites/alien_guardian.png?v=fix4",
  alien_guardian_move: "/sprites/alien_guardian_move.png?v=fix4",
  alien_guardian_move2: "/sprites/alien_guardian_move2.png?v=guard4",
  alien_guardian_attack: "/sprites/alien_guardian_attack.png?v=atk1",
  alien_dragoon: "/sprites/alien_dragoon.png?v=fix3",
  /** 용기병 위상포. 유닛 중심에서 날아가 맞을 때 피해가 들어간다. */
  fx_bolt_alien_dragoon: "/sprites/fx_bolt_alien_dragoon.png?v=bolt1",
  alien_dragoon_move: "/sprites/alien_dragoon_move.png?v=drag4",
  alien_dragoon_move2: "/sprites/alien_dragoon_move2.png?v=drag4",
  mineral_node: "/sprites/mineral_node.png",
  /** 일꾼 운반 중 미네랄 청크 */
  mineral_cargo: "/sprites/mineral_cargo.png",
  /** 봉우리 1장. 전장에서는 세로 2회 타일링으로 그린다. */
  ether_vent: "/sprites/ether_vent.png",
  /** 랠리포인트 마커 */
  rally_dot: "/sprites/rally_dot.png?v=reticle7",
  /** 이동·공격 목적지 마커 */
  move_dot: "/sprites/move_dot.png?v=reticle7",
  /** 선택 브래킷. 검정은 알파, 색은 HP 틴트 */
  select_bracket: "/sprites/select_bracket.png?v=bracket1",
  /** 인간 유닛 파괴 2프레임 */
  fx_human_die_1: "/sprites/fx_human_die_1.png?v=die1",
  fx_human_die_2: "/sprites/fx_human_die_2.png?v=die1",
  /** 괴물 유닛 파괴 2프레임 */
  fx_monster_die_1: "/sprites/fx_monster_die_1.png?v=die1",
  fx_monster_die_2: "/sprites/fx_monster_die_2.png?v=die1",
  /** 외계인 유닛 파괴 2프레임 */
  fx_alien_die_1: "/sprites/fx_alien_die_1.png?v=die1",
  fx_alien_die_2: "/sprites/fx_alien_die_2.png?v=die1",
  /** 피격 표식. 때린 유닛별로 한 장. */
  fx_hit_human_worker: "/sprites/fx_hit_human_worker.png?v=hit1",
  fx_hit_human_rifleman: "/sprites/fx_hit_human_rifleman.png?v=hit1",
  fx_hit_human_firebat: "/sprites/fx_hit_human_firebat.png?v=hit1",
  fx_hit_monster_blade: "/sprites/fx_hit_monster_blade.png?v=hit1",
  fx_hit_monster_hydra: "/sprites/fx_hit_monster_hydra.png?v=hit1",
  fx_hit_monster_worker: "/sprites/fx_hit_monster_worker.png?v=hit1",
  fx_hit_alien_worker: "/sprites/fx_hit_alien_worker.png?v=hit1",
  fx_hit_alien_guardian: "/sprites/fx_hit_alien_guardian.png?v=hit1",
  fx_hit_alien_dragoon: "/sprites/fx_hit_alien_dragoon.png?v=hit1",
  /** 건물 피해 파티클. 종족당 한 장. 개수·위치·투명도로 단계를 낸다. */
  fx_bldg_human_fire: "/sprites/fx_bldg_human_fire.png?v=bldgfx1",
  fx_bldg_monster_bleed: "/sprites/fx_bldg_monster_bleed.png?v=bldgfx1",
  fx_bldg_alien_fire: "/sprites/fx_bldg_alien_fire.png?v=bldgfx1",
};

/** 종족 유닛(일꾼·전투 유닛)이 사라질 때 재생할 프레임 typeId */
const DIE_FX_FRAMES: Partial<Record<"human" | "monster" | "alien", readonly [string, string]>> = {
  human: ["fx_human_die_1", "fx_human_die_2"],
  monster: ["fx_monster_die_1", "fx_monster_die_2"],
  alien: ["fx_alien_die_1", "fx_alien_die_2"],
};

/**
 * 때린 유닛의 피격 표식.
 * fill 은 1024 칸 중 불투명 픽셀의 긴 변 비율. 보이는 크기를 때린 유닛에 맞출 때 쓴다.
 */
const HIT_FX: Record<string, { frame: string; fill: number }> = {
  human_worker: { frame: "fx_hit_human_worker", fill: 49 / 1024 },
  human_rifleman: { frame: "fx_hit_human_rifleman", fill: 148 / 1024 },
  human_firebat: { frame: "fx_hit_human_firebat", fill: 500 / 1024 },
  monster_blade: { frame: "fx_hit_monster_blade", fill: 520 / 1024 },
  monster_hydra: { frame: "fx_hit_monster_hydra", fill: 312 / 1024 },
  monster_worker: { frame: "fx_hit_monster_worker", fill: 277 / 1024 },
  alien_worker: { frame: "fx_hit_alien_worker", fill: 232 / 1024 },
  alien_guardian: { frame: "fx_hit_alien_guardian", fill: 531 / 1024 },
  alien_dragoon: { frame: "fx_hit_alien_dragoon", fill: 508 / 1024 },
};

export function hitFx(
  attackerTypeId: string
): { frame: string; fill: number } | null {
  return HIT_FX[attackerTypeId] ?? null;
}

/** 건물·사령부 피해 파티클에 쓸 스프라이트. 없으면 null. */
export function buildingDamageFx(typeId: string): string | null {
  if (typeId.startsWith("human_")) return "fx_bldg_human_fire";
  if (typeId.startsWith("monster_")) return "fx_bldg_monster_bleed";
  if (typeId.startsWith("alien_")) return "fx_bldg_alien_fire";
  return null;
}

export function dieFxFrames(typeId: string): readonly [string, string] | null {
  const race = typeId.startsWith("human_")
    ? "human"
    : typeId.startsWith("monster_")
      ? "monster"
      : typeId.startsWith("alien_")
        ? "alien"
        : null;
  if (!race) return null;
  return DIE_FX_FRAMES[race] ?? null;
}

/**
 * 이동 애니메이션 프레임 typeId.
 * idle = 원본 typeId, 이동 중 = `_move` ↔ `_move2`.
 * 둘 다 없으면 null.
 */
/** 공격 중 정지했을 때 쓰는 스프라이트. 없으면 null. */
export function attackSprite(typeId: string): string | null {
  const id = `${typeId}_attack`;
  return SPRITE_URL[id] ? id : null;
}

export function walkFrames(typeId: string): readonly [string, string] | null {
  const move1 = `${typeId}_move`;
  const move2 = `${typeId}_move2`;
  if (!SPRITE_URL[move1] || !SPRITE_URL[move2]) return null;
  return [move1, move2];
}

/** SC식 선택창 와이어프레임(알파 마스크). 색은 CSS로 HP에 따라 칠한다. */
export const OUTLINE_URL: Record<string, string> = {
  human_worker: "/sprites/human_worker_outline.png?v=terran4",
};

/** 하단 정보 UI용 정면 대각뷰 초상화. */
const PORTRAIT_V = "v2";
export const PORTRAIT_URL: Record<string, string> = {
  human_hq: "/sprites/portraits/human_hq.png?v=bldg1",
  human_worker: `/sprites/portraits/human_worker.png?${PORTRAIT_V}`,
  human_barracks: "/sprites/portraits/human_barracks.png?v=bldg1",
  human_depot: "/sprites/portraits/human_depot.png?v=bldg1",
  human_refinery: "/sprites/portraits/human_refinery.png?v=bldg1",
  human_rifleman: `/sprites/portraits/human_rifleman.png?${PORTRAIT_V}`,
  human_firebat: "/sprites/portraits/human_firebat.png?v=fix5",
  human_medic: "/sprites/portraits/human_medic.png?v=fix5",
  human_academy: "/sprites/portraits/human_academy.png?v=bldg1",
  monster_hq: "/sprites/portraits/monster_hq.png?v=bldg1",
  monster_hatch: "/sprites/portraits/monster_hq.png?v=bldg1",
  monster_worker: `/sprites/portraits/monster_worker.png?${PORTRAIT_V}`,
  monster_hatchery: "/sprites/portraits/monster_hatchery.png?v=bldg1",
  monster_hydra_den: "/sprites/portraits/monster_hydra_den.png?v=bldg1",
  monster_extractor: "/sprites/portraits/monster_extractor.png?v=bldg1",
  monster_blade: `/sprites/portraits/monster_blade.png?${PORTRAIT_V}`,
  monster_hydra: "/sprites/portraits/monster_hydra.png?v=fix3",
  monster_sac: `/sprites/portraits/monster_sac.png?${PORTRAIT_V}`,
  monster_larva: `/sprites/portraits/monster_larva.png?${PORTRAIT_V}`,
  monster_egg: `/sprites/portraits/monster_egg.png?${PORTRAIT_V}`,
  alien_hq: "/sprites/portraits/alien_hq.png?v=bldg1",
  alien_worker: `/sprites/portraits/alien_worker.png?${PORTRAIT_V}`,
  alien_gate: "/sprites/portraits/alien_gate.png?v=bldg1",
  alien_cyber: "/sprites/portraits/alien_cyber.png?v=bldg1",
  alien_pylon: "/sprites/portraits/alien_pylon.png?v=pylon3",
  alien_assimilator: "/sprites/portraits/alien_assimilator.png?v=bldg1",
  alien_guardian: `/sprites/portraits/alien_guardian.png?${PORTRAIT_V}`,
  alien_dragoon: "/sprites/portraits/alien_dragoon.png?v=fix3",
  mineral_node: `/sprites/portraits/mineral_node.png?${PORTRAIT_V}`,
  ether_vent: `/sprites/portraits/ether_vent.png?${PORTRAIT_V}`,
};

export function spriteUrl(typeId: string): string | null {
  return SPRITE_URL[typeId] ?? null;
}

export function portraitUrl(typeId: string): string | null {
  return PORTRAIT_URL[typeId] ?? null;
}

export function outlineUrl(typeId: string): string | null {
  return OUTLINE_URL[typeId] ?? null;
}

/** 바닥·유닛·초상화 등 전투에 쓰는 이미지 URL 전부 */
export const FLOOR_MAP_URL = "/sprites/floor_map.png?v=5";
/** 괴물 크립 타일. 마스크 알파로 칸만 드러낸다. */
export const CREEP_URL = "/sprites/creep.png?v=creep3";

const imageCache = new Map<string, HTMLImageElement>();
let preloadPromise: Promise<void> | null = null;

function battleAssetUrls(): string[] {
  const urls: string[] = [FLOOR_MAP_URL, CREEP_URL];
  for (const k in SPRITE_URL) {
    if (Object.prototype.hasOwnProperty.call(SPRITE_URL, k)) {
      urls.push(SPRITE_URL[k]);
    }
  }
  for (const k in PORTRAIT_URL) {
    if (Object.prototype.hasOwnProperty.call(PORTRAIT_URL, k)) {
      urls.push(PORTRAIT_URL[k]);
    }
  }
  for (const k in OUTLINE_URL) {
    if (Object.prototype.hasOwnProperty.call(OUTLINE_URL, k)) {
      urls.push(OUTLINE_URL[k]);
    }
  }
  return urls;
}

function loadImageCached(url: string): Promise<HTMLImageElement> {
  const hit = imageCache.get(url);
  if (hit && hit.complete && hit.naturalWidth > 0) {
    return Promise.resolve(hit);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      // 실패해도 전체 대기를 막지 않는다
      resolve(img);
    };
    img.src = url;
  });
}

/** 전투 화면 진입 전 호출. 중복 호출은 같은 Promise 를 공유한다. */
export function preloadBattleAssets(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  const urls = battleAssetUrls();
  preloadPromise = Promise.all(urls.map(loadImageCached)).then(() => undefined);
  return preloadPromise;
}

export function getCachedImage(url: string): HTMLImageElement | null {
  const img = imageCache.get(url);
  if (img && img.complete && img.naturalWidth > 0) return img;
  return null;
}

/** 아군 HP 비율 → 초록 / 노랑 / 빨강 */
export function hpTone(hp: number, maxHp: number): "ok" | "mid" | "low" {
  const ratio = maxHp > 0 ? hp / maxHp : 0;
  if (ratio > 0.66) return "ok";
  if (ratio > 0.33) return "mid";
  return "low";
}
