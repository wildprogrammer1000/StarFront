/**
 * 사람 한 명 대전의 상대. 플레이어와 같은 입력만 쓴다.
 * Goja: class / Map / for..of / 스프레드 금지. 로컬 배열 push 는 괜찮다.
 */
import type { PlayerInput, RaceId, Side } from "@shared/protocol";
import { MAP, NEUTRAL, WORLD } from "./constants";
import type { MatchSim } from "./MatchSim";
import { buildingDef, footprintOf } from "./roster";

export const BOT_USER_ID = "bot";
const THINK_TICKS = 15;
const WORKER_CAP = 8;
const ARMY_ATTACK = 4;
const SUPPLY_CAP = 50;

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

function train(sim: MatchSim, player: Player, ents: Ent[], unitType: string): void {
  const hq = findHq(ents);
  if (!hq) return;
  let buildingId = hq.id;
  if (unitType === "human_rifleman") {
    const rax = readyBuilding(ents, "human_barracks");
    if (!rax || queueLen(rax) >= 2) return;
    buildingId = rax.id;
  } else if (unitType === "alien_guardian") {
    const gate = readyBuilding(ents, "alien_gate");
    if (!gate || queueLen(gate) >= 2) return;
    buildingId = gate.id;
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

function attackMoveArmy(sim: MatchSim, player: Player, ents: Ent[]): void {
  if (combatCount(ents) < ARMY_ATTACK) return;
  const foe = listSide(sim, enemySide(player.side));
  const hq = findHq(foe);
  if (!hq) return;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.kind !== "unit" || e.typeId === "monster_sac") continue;
    if (e.order === "attack" || e.order === "attack_move") continue;
    sim.applyInput(player.userId, {
      type: "order_attack_move",
      unitId: e.id,
      x: hq.x,
      z: hq.z,
    });
  }
  const rax = readyBuilding(ents, "human_barracks");
  const gate = readyBuilding(ents, "alien_gate");
  const rally = rax || gate;
  if (rally && typeof rally.rallyX !== "number") {
    sim.applyInput(player.userId, {
      type: "set_rally",
      buildingId: rally.id,
      x: hq.x,
      z: hq.z,
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

/** 채집하고, 인구·생산 건물을 짓고, 병력을 모아 적 본진으로 보낸다. */
export function tickBot(sim: MatchSim): void {
  if (sim.status !== "playing") return;
  if (sim.tick % THINK_TICKS !== 0) return;
  const player = sim.players[BOT_USER_ID];
  if (!player) return;
  const ents = listSide(sim, player.side);
  sendMiners(sim, player, ents);

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

  if (workerCount(ents) < WORKER_CAP) {
    const workerType =
      player.race === "monster"
        ? "monster_worker"
        : player.race === "alien"
          ? "alien_worker"
          : "human_worker";
    train(sim, player, ents, workerType);
  } else if (prodReady) {
    const army =
      player.race === "monster"
        ? "monster_blade"
        : player.race === "alien"
          ? "alien_guardian"
          : "human_rifleman";
    train(sim, player, ents, army);
  }

  attackMoveArmy(sim, player, ents);
}
