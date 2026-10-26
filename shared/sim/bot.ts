/**
 * 사람 한 명 대전의 상대. 플레이어와 같은 입력만 쓴다.
 * Goja: class / Map / for..of / 스프레드 금지. 로컬 배열 push 는 괜찮다.
 */
import type { PlayerInput, RaceId, Side } from "@shared/protocol";
import { MAP, NEUTRAL, WORLD } from "./constants";
import type { MatchSim } from "./MatchSim";
import { buildingDef, footprintOf, unitDef } from "./roster";

export const BOT_USER_ID = "bot";
const THINK_TICKS = 15;
const WORKER_CAP = 8;
const HARASS_AT = 2;
const COMMIT_AT = 6;
const SUPPLY_CAP = 50;
const CONTACT = 3.5;

export type BotDifficulty = "easy" | "normal" | "hard";

/** 쉬움 2초, 보통 1.5초, 어려움 0.4초. 틱은 10Hz. */
export function thinkTicksFor(id: BotDifficulty): number {
  if (id === "easy") return 20;
  if (id === "hard") return 4;
  return THINK_TICKS;
}

type Ent = MatchSim["entities"][string];
type Player = MatchSim["players"][string];

function eachEnt(sim: MatchSim, fn: (e: Ent) => void): void {
  const entities = sim.entities;
  for (const id in entities) {
    if (Object.prototype.hasOwnProperty.call(entities, id)) fn(entities[id]);
  }
}

function listSide(sim: MatchSim, side: Side): Ent[] {
  const out: Ent[] = [];
  eachEnt(sim, function (e) {
    if (e.side === side && e.hp > 0) out.push(e);
  });
  return out;
}

function findHq(ents: Ent[]): Ent | null {
  for (let i = 0; i < ents.length; i++) {
    if (ents[i].kind === "hq") return ents[i];
  }
  return null;
}

function enemySide(side: Side): Side {
  return side === "bottom" ? "top" : "bottom";
}

function supplyOf(sim: MatchSim, player: Player): { used: number; max: number } {
  let used = 0;
  let bonus = 0;
  let blades = 0;
  eachEnt(sim, function (e) {
    if (e.side !== player.side || e.hp <= 0) return;
    if (e.kind === "worker") used += 1;
    else if (e.kind === "unit" && e.typeId === "monster_blade") blades += 1;
    else if (e.kind === "unit" && e.typeId !== "monster_sac") used += 1;
    else if (e.kind === "egg") used += 1;
    if (e.typeId === "monster_sac") bonus += 8;
    if (!e.constructing && (e.typeId === "human_depot" || e.typeId === "alien_pylon")) {
      bonus += 8;
    }
  });
  const base = player.race === "monster" ? 0 : 10;
  used += Math.ceil(blades / 2);
  const max = base + bonus;
  return { used: used, max: max < SUPPLY_CAP ? max : SUPPLY_CAP };
}

function workerCount(ents: Ent[]): number {
  let n = 0;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.kind === "worker") n += 1;
    else if (e.kind === "egg" && e.morphType && e.morphType.indexOf("worker") >= 0) n += 1;
  }
  return n;
}

function combatCount(ents: Ent[]): number {
  let n = 0;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.kind === "unit" && e.typeId !== "monster_sac") n += 1;
  }
  return n;
}

function hasType(ents: Ent[], typeId: string, includePending: boolean): boolean {
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.typeId === typeId && (e.kind === "building" || e.kind === "hq")) return true;
    if (includePending && e.morphBuild === typeId) return true;
  }
  return false;
}

function readyBuilding(ents: Ent[], typeId: string): Ent | null {
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.typeId === typeId && !e.constructing && (e.kind === "building" || e.kind === "hq")) {
      return e;
    }
  }
  return null;
}

function queueLen(e: Ent): number {
  const q = e.queue;
  if (!q || typeof q.length !== "number") return 0;
  return q.length;
}

function builder(ents: Ent[]): Ent | null {
  let fallback: Ent | null = null;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.kind !== "worker" || e.hp <= 0) continue;
    if (e.morphBuild || e.busyOn) continue;
    if (e.harvestSource === "gas" && e.harvestPhase === "mining") continue;
    if (!e.harvestPhase && !e.order) return e;
    if (!fallback && (e.carry || 0) <= 0) fallback = e;
  }
  return fallback;
}

function inBuildZone(side: Side, x: number, z: number): boolean {
  if (Math.abs(x) > WORLD.halfWidth - 0.5) return false;
  if (Math.abs(z) < NEUTRAL.halfDepth) return false;
  if (side === "bottom") return z <= -NEUTRAL.halfDepth && z > -WORLD.halfDepth + 0.5;
  return z >= NEUTRAL.halfDepth && z < WORLD.halfDepth - 0.5;
}

function blockCenter(cx: number, cz: number, w: number, d: number): { x: number; z: number } {
  return {
    x: -WORLD.halfWidth + (cx + w / 2) * MAP.cellSize,
    z: -WORLD.halfDepth + (cz + d / 2) * MAP.cellSize,
  };
}

function tryBuild(sim: MatchSim, player: Player, typeId: string, ents: Ent[]): boolean {
  const def = buildingDef(typeId);
  if (!def || def.race !== player.race) return false;
  if (player.minerals < def.costM || player.energy < def.costE) return false;
  if (hasType(ents, typeId, true) && def.role !== "supply") return false;
  const worker = builder(ents);
  const hq = findHq(ents);
  if (!worker || !hq) return false;
  const fp = footprintOf(typeId);
  const origin = {
    cx: Math.round((hq.x + WORLD.halfWidth) / MAP.cellSize - 3),
    cz: Math.round((hq.z + WORLD.halfDepth) / MAP.cellSize - 3),
  };
  let tries = 0;
  for (let ring = 1; ring <= 8 && tries < 40; ring++) {
    for (let dz = -ring; dz <= ring && tries < 40; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.abs(dx) !== ring && Math.abs(dz) !== ring) continue;
        tries += 1;
        const spot = blockCenter(origin.cx + dx, origin.cz + dz, fp.w, fp.d);
        if (!inBuildZone(player.side, spot.x, spot.z)) continue;
        sim.applyInput(player.userId, {
          type: "place_building",
          buildingType: typeId,
          x: spot.x,
          z: spot.z,
          workerId: worker.id,
        });
        if (worker.morphBuild === typeId) return true;
      }
    }
  }
  return false;
}

function oneLarva(ents: Ent[]): Ent | null {
  for (let i = 0; i < ents.length; i++) {
    if (ents[i].kind === "larva") return ents[i];
  }
  return null;
}

function producerType(unitType: string): string | null {
  if (
    unitType === "human_rifleman" ||
    unitType === "human_firebat" ||
    unitType === "human_medic"
  ) {
    return "human_barracks";
  }
  if (unitType === "alien_guardian" || unitType === "alien_dragoon") {
    return "alien_gate";
  }
  return null;
}

function train(sim: MatchSim, player: Player, ents: Ent[], unitType: string): void {
  const hq = findHq(ents);
  if (!hq) return;
  let buildingId = hq.id;
  const producedAt = producerType(unitType);
  if (producedAt) {
    const source = readyBuilding(ents, producedAt);
    if (!source || queueLen(source) >= 2) return;
    buildingId = source.id;
  } else if (player.race !== "monster") {
    if (queueLen(hq) >= 1) return;
  }
  const input: PlayerInput = {
    type: "enqueue_unit",
    buildingId: buildingId,
    unitType: unitType,
  };
  if (player.race === "monster") {
    const larva = oneLarva(ents);
    if (!larva) return;
    input.larvaIds = [larva.id];
  }
  sim.applyInput(player.userId, input);
}

function sendMiners(sim: MatchSim, player: Player, ents: Ent[]): void {
  const nodes: Ent[] = [];
  for (let i = 0; i < ents.length; i++) {
    if (ents[i].kind === "mineral" && ents[i].hp > 0) nodes.push(ents[i]);
  }
  if (nodes.length === 0) return;
  let n = 0;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.kind !== "worker" || e.hp <= 0) continue;
    if (e.harvestPhase || e.morphBuild || e.busyOn || e.order) continue;
    if (e.harvestSource === "gas") continue;
    const node = nodes[n % nodes.length];
    n += 1;
    sim.applyInput(player.userId, {
      type: "order_harvest",
      workerId: e.id,
      mineralId: node.id,
    });
  }
}

function dist(a: Ent, b: Ent): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function gasType(race: RaceId): string {
  if (race === "monster") return "monster_extractor";
  if (race === "alien") return "alien_assimilator";
  return "human_refinery";
}

function techType(race: RaceId): string {
  if (race === "monster") return "monster_hydra_den";
  if (race === "alien") return "alien_cyber";
  return "human_academy";
}

function basicUnit(race: RaceId): string {
  if (race === "monster") return "monster_blade";
  if (race === "alien") return "alien_guardian";
  return "human_rifleman";
}

function techUnit(race: RaceId): string {
  if (race === "monster") return "monster_hydra";
  if (race === "alien") return "alien_dragoon";
  return "human_firebat";
}

function isRanged(typeId: string): boolean {
  return (
    typeId === "human_rifleman" ||
    typeId === "monster_hydra" ||
    typeId === "alien_dragoon"
  );
}

function weaponRange(typeId: string): number {
  if (typeId === "alien_dragoon") return 1.92;
  if (isRanged(typeId)) return 2.4;
  return 0.6;
}

function canAfford(player: Player, typeId: string): boolean {
  const def = unitDef(typeId);
  if (!def) return false;
  return player.minerals >= def.costM && player.energy >= def.costE;
}

function countMade(ents: Ent[], typeId: string): number {
  let n = 0;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.typeId === typeId && e.hp > 0) n += 1;
    else if (e.kind === "egg" && e.morphType === typeId) n += 1;
  }
  return n;
}

function tryBuildAt(
  sim: MatchSim,
  player: Player,
  typeId: string,
  ents: Ent[],
  x: number,
  z: number
): boolean {
  const def = buildingDef(typeId);
  if (!def || def.race !== player.race) return false;
  if (player.minerals < def.costM || player.energy < def.costE) return false;
  const worker = builder(ents);
  if (!worker) return false;
  sim.applyInput(player.userId, {
    type: "place_building",
    buildingType: typeId,
    x: x,
    z: z,
    workerId: worker.id,
  });
  return worker.morphBuild === typeId;
}

function ownVent(ents: Ent[]): Ent | null {
  for (let i = 0; i < ents.length; i++) {
    if (ents[i].kind === "gas" && ents[i].hp > 0) return ents[i];
  }
  return null;
}

function sendGasMiners(sim: MatchSim, player: Player, ents: Ent[]): void {
  const gasId = gasType(player.race);
  const building = readyBuilding(ents, gasId);
  if (!building) return;
  let onGas = 0;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.kind === "worker" && e.harvestSource === "gas") onGas += 1;
  }
  if (onGas >= 2) return;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.kind !== "worker" || e.hp <= 0) continue;
    if (e.id === sim.botScoutId) continue;
    if (e.harvestSource === "gas") continue;
    if (e.morphBuild || e.busyOn) continue;
    if (!e.harvestPhase) continue;
    sim.applyInput(player.userId, {
      type: "order_harvest",
      workerId: e.id,
      mineralId: building.id,
    });
    return;
  }
}

function stepTech(sim: MatchSim, player: Player, ents: Ent[]): void {
  if (workerCount(ents) < 6) return;
  const gasId = gasType(player.race);
  if (!hasType(ents, gasId, true)) {
    const vent = ownVent(ents);
    if (vent) tryBuildAt(sim, player, gasId, ents, vent.x, vent.z);
    return;
  }
  if (!readyBuilding(ents, gasId)) return;
  const tech = techType(player.race);
  if (hasType(ents, tech, true)) return;
  const needs =
    player.race === "monster"
      ? "monster_hatchery"
      : player.race === "alien"
        ? "alien_gate"
        : "human_barracks";
  if (!readyBuilding(ents, needs)) return;
  tryBuild(sim, player, tech, ents);
}

function nextArmy(player: Player, ents: Ent[]): string {
  const basic = basicUnit(player.race);
  const advanced = techUnit(player.race);
  const tech = techType(player.race);
  if (readyBuilding(ents, tech) && canAfford(player, advanced)) {
    if (countMade(ents, advanced) < countMade(ents, basic)) return advanced;
  }
  return basic;
}

function scout(sim: MatchSim, player: Player, ents: Ent[]): void {
  const foe = listSide(sim, enemySide(player.side));
  const enemyHq = findHq(foe);
  const home = findHq(ents);
  if (!enemyHq || !home) return;
  const scoutId = sim.botScoutId;
  const current = scoutId ? sim.entities[scoutId] : null;
  if (current && current.hp > 0) {
    if (dist(current, enemyHq) < 2.4) {
      sim.botScoutSeen = 1;
      sim.botScoutId = "";
      sim.applyInput(player.userId, {
        type: "order_move",
        unitId: current.id,
        x: home.x,
        z: home.z,
      });
    }
    return;
  }
  if (sim.botScoutSeen) return;
  if (workerCount(ents) < 5) return;
  let pick: Ent | null = null;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.kind !== "worker" || e.hp <= 0) continue;
    if (e.morphBuild || e.busyOn) continue;
    if (e.harvestSource === "gas") continue;
    if (e.harvestPhase !== "to_mineral" && e.harvestPhase !== "mining") continue;
    pick = e;
  }
  if (!pick) return;
  const z = enemyHq.z + (player.side === "bottom" ? -2.2 : 2.2);
  sim.botScoutId = pick.id;
  sim.applyInput(player.userId, {
    type: "order_move",
    unitId: pick.id,
    x: enemyHq.x,
    z: z,
  });
}

function nearest(
  from: Ent,
  foes: Ent[],
  maxDist: number,
  want: (e: Ent) => boolean
): Ent | null {
  let best: Ent | null = null;
  let bestD = maxDist;
  for (let i = 0; i < foes.length; i++) {
    const e = foes[i];
    if (!want(e)) continue;
    const d = dist(from, e);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

function focusTarget(from: Ent, foes: Ent[]): Ent | null {
  let best: Ent | null = null;
  let bestRatio = 2;
  for (let i = 0; i < foes.length; i++) {
    const e = foes[i];
    if (e.kind !== "unit" && e.kind !== "worker") continue;
    if (e.typeId === "monster_sac") continue;
    if (dist(from, e) > CONTACT) continue;
    const ratio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
    if (ratio < bestRatio) {
      best = e;
      bestRatio = ratio;
    }
  }
  if (best) return best;
  return nearest(from, foes, CONTACT, function (e) {
    return e.kind === "building" || e.kind === "hq";
  });
}

function issueAttack(sim: MatchSim, player: Player, unit: Ent, target: Ent): void {
  if (unit.order === "attack" && unit.orderTargetId === target.id) return;
  sim.applyInput(player.userId, {
    type: "order_attack",
    unitId: unit.id,
    targetId: target.id,
  });
}

function controlArmy(sim: MatchSim, player: Player, ents: Ent[]): void {
  const foes = listSide(sim, enemySide(player.side));
  const enemyHq = findHq(foes);
  const home = findHq(ents);
  if (!enemyHq || !home) return;
  const army = combatCount(ents);
  const seen = sim.botScoutSeen === 1;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.kind !== "unit" || e.hp <= 0) continue;
    if (e.typeId === "monster_sac") continue;
    if (e.typeId === "human_medic") {
      if (!e.order) {
        const friend = nearest(e, ents, 30, function (u) {
          return u.kind === "unit" && u.typeId !== "monster_sac" && u.typeId !== "human_medic";
        });
        if (friend) {
          sim.applyInput(player.userId, {
            type: "order_move",
            unitId: e.id,
            x: friend.x,
            z: friend.z,
          });
        }
      }
      continue;
    }
    const ratio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
    if (ratio < 0.35) {
      if (e.order !== "move") {
        sim.applyInput(player.userId, {
          type: "order_move",
          unitId: e.id,
          x: home.x,
          z: home.z,
        });
      }
      continue;
    }
    const threat = nearest(e, foes, weaponRange(e.typeId) * 0.7, function (u) {
      return (u.kind === "unit" || u.kind === "worker") && u.typeId !== "monster_sac";
    });
    if (isRanged(e.typeId) && threat && e.order === "attack") {
      const dx = e.x - threat.x;
      const dz = e.z - threat.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      sim.applyInput(player.userId, {
        type: "order_move",
        unitId: e.id,
        x: e.x + (dx / len) * 1.4,
        z: e.z + (dz / len) * 1.4,
      });
      continue;
    }
    const focus = focusTarget(e, foes);
    if (focus) {
      issueAttack(sim, player, e, focus);
      continue;
    }
    if (seen && army < COMMIT_AT) {
      const worker = nearest(e, foes, 40, function (u) {
        return u.kind === "worker";
      });
      if (worker && army >= HARASS_AT) {
        issueAttack(sim, player, e, worker);
        continue;
      }
    }
    if (army >= 4 && e.order !== "attack" && e.order !== "attack_move") {
      sim.applyInput(player.userId, {
        type: "order_attack_move",
        unitId: e.id,
        x: enemyHq.x,
        z: enemyHq.z,
      });
    }
  }
  if (army < 4) return;
  const rax = readyBuilding(ents, "human_barracks");
  const gate = readyBuilding(ents, "alien_gate");
  const rally = rax || gate;
  if (rally && typeof rally.rallyX !== "number") {
    sim.applyInput(player.userId, {
      type: "set_rally",
      buildingId: rally.id,
      x: enemyHq.x,
      z: enemyHq.z,
    });
  }
}

function productionType(race: RaceId): string {
  if (race === "monster") return "monster_hatchery";
  if (race === "alien") return "alien_gate";
  return "human_barracks";
}

function supplyPending(ents: Ent[], race: RaceId): boolean {
  if (race === "monster") {
    for (let i = 0; i < ents.length; i++) {
      if (ents[i].kind === "egg" && ents[i].morphType === "monster_sac") return true;
    }
    return false;
  }
  const typeId = race === "alien" ? "alien_pylon" : "human_depot";
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.typeId === typeId && e.constructing) return true;
    if (e.morphBuild === typeId) return true;
  }
  return false;
}

/** 채집·테크·정찰·견제·교전을 난이도 간격마다 판단한다. */
export function tickBot(sim: MatchSim): void {
  if (sim.status !== "playing") return;
  const every =
    typeof sim.botThinkTicks === "number" && sim.botThinkTicks > 0
      ? sim.botThinkTicks
      : THINK_TICKS;
  if (sim.tick % every !== 0) return;
  const player = sim.players[BOT_USER_ID];
  if (!player) return;
  const ents = listSide(sim, player.side);
  sendMiners(sim, player, ents);
  sendGasMiners(sim, player, ents);

  const supply = supplyOf(sim, player);
  const tight = supply.used + 2 > supply.max && supply.max < SUPPLY_CAP;
  if (tight && !supplyPending(ents, player.race)) {
    if (player.race === "monster") train(sim, player, ents, "monster_sac");
    else tryBuild(sim, player, player.race === "alien" ? "alien_pylon" : "human_depot", ents);
  }

  const prod = productionType(player.race);
  const prodReady = !!readyBuilding(ents, prod);
  if (!prodReady && !hasType(ents, prod, true)) {
    if (player.race === "alien" && !readyBuilding(ents, "alien_pylon")) {
      if (!hasType(ents, "alien_pylon", true)) tryBuild(sim, player, "alien_pylon", ents);
    } else {
      tryBuild(sim, player, prod, ents);
    }
  }

  stepTech(sim, player, ents);

  if (workerCount(ents) < WORKER_CAP) {
    const workerType =
      player.race === "monster"
        ? "monster_worker"
        : player.race === "alien"
          ? "alien_worker"
          : "human_worker";
    train(sim, player, ents, workerType);
  } else if (prodReady) {
    train(sim, player, ents, nextArmy(player, ents));
  }

  scout(sim, player, ents);
  controlArmy(sim, player, ents);
}
