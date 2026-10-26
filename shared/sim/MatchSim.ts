/**
 * Goja (Nakama JS) 호환: ES6 class / Map / for..of / 스프레드 이터레이터 사용 금지.
 */
import { tickBot } from "./bot";
import {
  COUNTDOWN_SEC,
  ENERGY,
  FOOTPRINT,
  GAS,
  HQ,
  MAP,
  MINERAL,
  NEUTRAL,
  START_WORKERS,
  TICK_DT,
  MOVE_SPEED_SCALE,
  UNIT_COLLISION,
  WORKER_SPEED,
  WORKER_STOP,
  WORLD,
} from "./constants";
import { cellInPylonPower } from "@shared/pylonPower";
import {
  LARVA_CAP,
  LARVA_SEC,
  SUPPLY_BONUS,
  SUPPLY_CAP,
  buildingDef,
  footprintOf,
  unitDef,
  unitProducedAt,
} from "./roster";
import type {
  EntitySnap,
  HitSnap,
  MatchSnapshot,
  MatchStatus,
  PlayerInput,
  PlayerSnap,
  RaceId,
  Side,
} from "@shared/protocol";
import { PROTOCOL_VERSION } from "@shared/protocol";
import { isAirUnit, layersCollide } from "@shared/unitLayers";
import {
  buildingNeedsCreep,
  emptyCreep,
  fillStartingCreep,
  footprintOnCreep,
  speedOnCreep,
  tickCreep,
} from "./creep";

export interface SimPlayer {
  userId: string;
  sessionId: string;
  side: Side;
  race: RaceId;
  energy: number;
  minerals: number;
  ready: boolean;
  displayName?: string;
  mineralsGained: number;
  mineralsSpent: number;
  etherGained: number;
  etherSpent: number;
  unitsMade: number;
}

interface SimEntity {
  id: string;
  kind: EntitySnap["kind"];
  side: Side;
  typeId: string;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  rallyX?: number;
  rallyZ?: number;
  constructing?: boolean;
  buildLeft?: number;
  buildSec?: number;
  larva?: number;
  larvaAcc?: number;
  queue?: string[];
  prodLeft?: number;
  /** 알 변태 대상 유닛 typeId */
  morphType?: string;
  morphLeft?: number;
  morphSec?: number;
  /** 칼날충 짝. 알에서 같이 나온 첫 유닛 id */
  hatchOf?: string;
  /** 이 일꾼이 짓고 있는 건물 */
  busyOn?: string;
  /** 괴물 변태 건설: 도착 전 예약된 건물 */
  morphBuild?: string;
  morphX?: number;
  morphZ?: number;
  /** 인간 건설: 향하는 꼭지점 인덱스 0–3 */
  buildCorner?: number;
  /** 같은 모서리가 다시 걸렸을 때 남은 대기(초) */
  buildWait?: number;
  /** 채취 FSM. 에테르는 건물 안에서 mining. */
  harvestPhase?: "to_mineral" | "mining" | "to_hq";
  harvestMineralId?: string;
  harvestHqId?: string;
  /** 없으면 미네랄. gas 는 에테르 건물 출입. */
  harvestSource?: "mineral" | "gas";
  /** 들고 있는 화물이 에테르면 gas. 없으면 미네랄. */
  carryKind?: "gas";
  carry?: number;
  mineLeft?: number;
  /** 이동·공격·공격이동 명령 */
  order?: "move" | "attack" | "attack_move";
  orderX?: number;
  orderZ?: number;
  orderTargetId?: string;
  /** 이 명령을 받은 틱. 같은 클릭의 모임 자리만 피한다. */
  orderTick?: number;
  /** 이번 공격에서 잡으려는 자리. 같은 목표의 다른 유닛이 피한다. */
  approachX?: number;
  approachZ?: number;
  attackCd?: number;
  /** 유충이 속한 산란소 */
  homeId?: string;
  /** 유충 배회. 알 변태는 이 좌표를 그대로 쓴다. */
  crawlHeading?: number;
  crawlTangent?: number;
  crawlSpeed?: number;
  crawlFlip?: number;
  /** 장애물 우회. 1=좌, -1=우. 몇 틱 유지한 뒤 진전이 없으면 뒤집는다. */
  slideSign?: number;
  slideHold?: number;
  navBest?: number;
  navStuck?: number;
  /** 격자 최단 경로. 빈 배열은 계산했지만 길이 없음. */
  navXs?: number[];
  navZs?: number[];
  navI?: number;
  navGX?: number;
  navGZ?: number;
  /** 직선이 열려 있음. occRev 와 같으면 목적지까지 다시 검사하지 않는다. */
  navLineOk?: number;
  navLineRev?: number;
  /** 격자 경로에서 직선으로 보이는 가장 먼 경유점. */
  navFar?: number;
  navFarRev?: number;
  /** 이번 틱에 실제로 좌표가 바뀐 틱 번호. 밀어내기 후보. */
  movedTick?: number;
  /** 건물과 겹쳐 끼었을 때, 가장 가까운 빈 칸까지 밀어내기. */
  ejectX?: number;
  ejectZ?: number;
}

/** 피격 한 번. 맞은 유닛과 그 주변 아군이 가해자를 친다. */
interface Retaliation {
  victimId: string;
  attackerId: string;
  x: number;
  z: number;
  side: Side;
}

export interface MatchSim {
  tick: number;
  status: MatchStatus;
  countdownLeft: number;
  hostUserId: string;
  roomName: string;
  inviteCode: string;
  winnerSide?: Side | "draw";
  players: { [userId: string]: SimPlayer };
  entities: { [id: string]: SimEntity };
  /** 괴물 크립 비트열 */
  creep: string;
  creepSpread: number;
  creepRecede: number;
  /** 이번 틱 피격. 스냅샷에 실어 보낸 뒤 비운다. */
  hits?: HitSnap[];
  /** 날아가는 투사체. 배열은 통째로 다시 넣는다. */
  bolts?: SimBolt[];
  /** 이번 틱 피격 대응. 처리 뒤 비운다. */
  retaliations?: Retaliation[];
  nextId: number;
  playerCount: () => number;
  addPlayer: (
    userId: string,
    sessionId: string,
    side: Side,
    displayName?: string
  ) => void;
  removePlayer: (userId: string) => void;
  setHost: (userId: string) => void;
  beginCountdown: () => boolean;
  applyInput: (userId: string, input: PlayerInput) => void;
  step: () => void;
  snapshot: () => MatchSnapshot;
}

function countKeys(obj: { [key: string]: unknown }): number {
  let n = 0;
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) n += 1;
  }
  return n;
}

function eachPlayer(
  players: { [userId: string]: SimPlayer },
  fn: (p: SimPlayer) => void
): void {
  for (const k in players) {
    if (Object.prototype.hasOwnProperty.call(players, k)) {
      fn(players[k]);
    }
  }
}

function eachEntity(
  entities: { [id: string]: SimEntity },
  fn: (e: SimEntity) => void
): void {
  for (const k in entities) {
    if (Object.prototype.hasOwnProperty.call(entities, k)) {
      fn(entities[k]);
    }
  }
}

/**
 * Goja/Nakama: `obj.arr = []; obj.arr.push(x)` 는 push가 match state에
 * 반영되지 않는 경우가 있다. 복사 후 통째로 재할당해야 한다.
 * @see https://forum.heroiclabs.com/t/pushing-items-in-newly-created-arrays/5289
 */
function copyStrArr(src: string[] | undefined | null): string[] {
  const out: string[] = [];
  if (!src) return out;
  const n = src.length;
  if (typeof n !== "number" || n <= 0) return out;
  for (let i = 0; i < n; i++) {
    const v = src[i];
    if (typeof v === "string") out.push(v);
  }
  return out;
}

/**
 * Goja는 매 틱 state를 map으로 export하며 메서드가 사라진다.
 * 데이터 필드만 남긴 객체에 메서드를 다시 붙인다.
 */
export function bindMatchSim(raw: MatchSim | Record<string, unknown>): MatchSim {
  const sim = raw as MatchSim;
  if (!sim.players) sim.players = {};
  if (!sim.entities) sim.entities = {};
  if (typeof sim.tick !== "number") sim.tick = 0;
  if (!sim.status) sim.status = "waiting";
  if (typeof sim.countdownLeft !== "number") sim.countdownLeft = 0;
  if (typeof sim.hostUserId !== "string") sim.hostUserId = "";
  if (typeof sim.roomName !== "string") sim.roomName = "";
  if (typeof sim.inviteCode !== "string") sim.inviteCode = "";
  if (typeof sim.nextId !== "number") sim.nextId = 1;
  if (typeof sim.creep !== "string") sim.creep = emptyCreep();
  if (typeof sim.creepSpread !== "number") sim.creepSpread = 0;
  if (typeof sim.creepRecede !== "number") sim.creepRecede = 0;

  sim.playerCount = function () {
    return countKeys(sim.players);
  };

  sim.addPlayer = function (userId, sessionId, side, displayName) {
    const name = (displayName || "").trim().slice(0, 16);
    const existing = sim.players[userId];
    if (existing) {
      existing.sessionId = sessionId;
      existing.side = side;
      if (name) existing.displayName = name;
      return;
    }
    sim.players[userId] = {
      userId: userId,
      sessionId: sessionId,
      side: side,
      race: "human",
      energy: ENERGY.start,
      minerals: MINERAL.start,
      ready: false,
      displayName: name || undefined,
      mineralsGained: 0,
      mineralsSpent: 0,
      etherGained: 0,
      etherSpent: 0,
      unitsMade: 0,
    };
    if (!sim.hostUserId) {
      sim.hostUserId = userId;
    }
  };

  sim.removePlayer = function (userId) {
    delete sim.players[userId];
    if (sim.status === "countdown") {
      sim.status = "waiting";
      sim.countdownLeft = 0;
    }
  };

  sim.setHost = function (userId) {
    sim.hostUserId = userId || "";
  };

  sim.beginCountdown = function () {
    if (sim.status !== "waiting") return false;
    if (sim.playerCount() < 2) return false;
    sim.status = "countdown";
    sim.countdownLeft = COUNTDOWN_SEC;
    return true;
  };

  sim.applyInput = function (userId, input) {
    const player = sim.players[userId];
    if (!player) return;

    if (sim.status === "waiting") {
      if (input.type === "set_race") {
        player.race = input.race;
      }
      return;
    }

    if (sim.status !== "playing") return;

    if (input.type === "place_building") {
      placeBuilding(
        sim,
        player,
        input.buildingType,
        input.x,
        input.z,
        input.workerId
      );
    } else if (input.type === "enqueue_unit") {
      enqueueUnit(
        sim,
        player,
        input.buildingId,
        input.unitType,
        input.larvaIds
      );
    } else if (input.type === "cancel_queue") {
      cancelQueue(sim, player, input.buildingId, input.queueIndex);
    } else if (input.type === "cancel_morph") {
      cancelMorph(sim, player, input.eggId);
    } else if (input.type === "set_rally") {
      setRallyPoint(sim, player, input.buildingId, input.x, input.z);
    } else if (input.type === "clear_rally") {
      clearRallyPoint(sim, player, input.buildingId);
    } else if (input.type === "order_harvest") {
      orderHarvest(sim, player, input.workerId, input.mineralId);
    } else if (input.type === "order_move") {
      orderMove(sim, player, input.unitId, input.x, input.z);
    } else if (input.type === "order_attack") {
      orderAttack(sim, player, input.unitId, input.targetId);
    } else if (input.type === "order_attack_move") {
      orderAttackMove(sim, player, input.unitId, input.x, input.z);
    }
  };

  sim.step = function () {
    if (sim.status === "countdown") {
      sim.countdownLeft = Math.max(0, sim.countdownLeft - TICK_DT);
      if (sim.countdownLeft <= 0) {
        bootstrapWorld(sim);
        sim.status = "playing";
        sim.countdownLeft = 0;
      }
      return;
    }

    if (sim.status !== "playing") return;
    sim.tick += 1;
    delete sim.hits;
    delete sim.retaliations;

    tickConstruction(sim);
    refreshOccupancy(sim);
    pushOverlappingStructures(sim);
    tickEject(sim);
    tickBuilders(sim);
    tickLarva(sim);
    tickLarvaMove(sim);
    tickProduction(sim);
    tickEggs(sim);
    tickBot(sim);
    tickHarvest(sim);
    tickUnitOrders(sim);
    separateAllies(sim);
    tickCreep(sim);
    keepMobilesOnMap(sim);
  };

  sim.snapshot = function () {
    const players: PlayerSnap[] = [];
    eachPlayer(sim.players, function (p) {
      const supply = supplyState(sim, p);
      players.push({
      userId: p.userId,
      sessionId: p.sessionId,
      side: p.side,
      race: p.race,
      energy: Math.floor(p.energy),
      minerals: Math.floor(p.minerals),
        supply: supply.used,
        supplyMax: supply.max,
        displayName: p.displayName || undefined,
        mineralsGained: Math.floor(p.mineralsGained || 0),
        mineralsSpent: Math.floor(p.mineralsSpent || 0),
        etherGained: Math.floor(p.etherGained || 0),
        etherSpent: Math.floor(p.etherSpent || 0),
        unitsMade: Math.floor(p.unitsMade || 0),
      });
    });

    const hits = sim.hits;
    delete sim.hits;

    const entities: EntitySnap[] = [];
    eachEntity(sim.entities, function (e) {
      const queueSnap = copyStrArr(e.queue);
      const head = queueSnap.length > 0 ? unitDef(queueSnap[0]) : null;
      const aim = attackAim(sim, e);
      entities.push({
      id: e.id,
      kind: e.kind,
      side: e.side,
      typeId: e.typeId,
      x: e.x,
      z: e.z,
      hp: e.hp,
      maxHp: e.maxHp,
        rallyX: isFiniteNum(e.rallyX) ? e.rallyX : undefined,
        rallyZ: isFiniteNum(e.rallyZ) ? e.rallyZ : undefined,
        constructing: e.constructing ? true : undefined,
        buildLeft:
          e.constructing && typeof e.buildLeft === "number"
            ? e.buildLeft
            : undefined,
        buildSec:
          e.constructing && typeof e.buildSec === "number"
            ? e.buildSec
            : undefined,
        larva:
          typeof e.larva === "number" && isMonsterProducer(e) ? e.larva : undefined,
        homeId: e.kind === "larva" && e.homeId ? e.homeId : undefined,
        queue: queueSnap.length > 0 ? queueSnap : undefined,
        prodLeft:
          head && typeof e.prodLeft === "number" ? e.prodLeft : undefined,
        prodSec: head ? head.time : undefined,
        morphType: e.kind === "egg" && e.morphType ? e.morphType : undefined,
        morphLeft:
          e.kind === "egg" && typeof e.morphLeft === "number"
            ? e.morphLeft
            : undefined,
        morphSec:
          e.kind === "egg" && typeof e.morphSec === "number"
            ? e.morphSec
            : undefined,
        hatchOf: e.hatchOf || undefined,
        carry:
          e.kind === "worker" && (e.carry || 0) > 0 ? e.carry : undefined,
        inside:
          e.kind === "worker" &&
          e.harvestSource === "gas" &&
          e.harvestPhase === "mining"
            ? true
            : undefined,
        order: e.order,
        harvesting: e.harvestPhase ? true : undefined,
        building: e.busyOn || e.morphBuild ? true : undefined,
        orderX:
          (e.order === "move" || e.order === "attack_move") &&
          typeof e.orderX === "number"
            ? e.orderX
            : undefined,
        orderZ:
          (e.order === "move" || e.order === "attack_move") &&
          typeof e.orderZ === "number"
            ? e.orderZ
            : undefined,
        aimX: aim ? aim.x : undefined,
        aimZ: aim ? aim.z : undefined,
      });
    });
    const bolts = sim.bolts;
    if (bolts) {
      const bn = bolts.length;
      for (let i = 0; i < bn; i++) {
        const b = bolts[i];
        entities.push({
          id: b.id,
          kind: "bolt",
          side: b.side,
          typeId: b.typeId,
          x: b.x,
          z: b.z,
          hp: 1,
          maxHp: 1,
          attackerId: b.attackerId,
        });
      }
    }

    const snap: MatchSnapshot = {
      protocolVersion: PROTOCOL_VERSION,
      tick: sim.tick,
      status: sim.status,
      hostUserId: sim.hostUserId,
      roomName: sim.roomName,
      inviteCode: sim.inviteCode,
      winnerSide: sim.winnerSide,
      playSec: sim.tick * TICK_DT,
      players: players,
      entities: entities,
      creep: sim.creep || emptyCreep(),
      hits: hits && hits.length > 0 ? hits : undefined,
    };
    if (sim.status === "countdown") {
      snap.countdown = Math.max(1, Math.ceil(sim.countdownLeft));
    }
    return snap;
  };

  return sim;
}

export function createMatchSim(meta?: {
  hostUserId?: string;
  roomName?: string;
  inviteCode?: string;
}): MatchSim {
  return bindMatchSim({
    tick: 0,
    status: "waiting",
    countdownLeft: 0,
    hostUserId: (meta && meta.hostUserId) || "",
    roomName: (meta && meta.roomName) || "",
    inviteCode: (meta && meta.inviteCode) || "",
    winnerSide: undefined,
    players: {},
    entities: {},
    creep: emptyCreep(),
    creepSpread: 0,
    creepRecede: 0,
    nextId: 1,
  } as MatchSim);
}

function spawn(
  sim: MatchSim,
  partial: {
    kind: SimEntity["kind"];
    side: Side;
    typeId: string;
    x: number;
    z: number;
    hp: number;
    maxHp: number;
    rallyX?: number;
    rallyZ?: number;
    order?: SimEntity["order"];
    orderX?: number;
    orderZ?: number;
    id?: string;
  }
): SimEntity {
  const id = partial.id ? partial.id : "e" + sim.nextId++;
  const ent: SimEntity = {
    id: id,
    kind: partial.kind,
    side: partial.side,
    typeId: partial.typeId,
    x: partial.x,
    z: partial.z,
    hp: partial.hp,
    maxHp: partial.maxHp,
  };
  if (isFiniteNum(partial.rallyX)) ent.rallyX = partial.rallyX;
  if (isFiniteNum(partial.rallyZ)) ent.rallyZ = partial.rallyZ;
  if (partial.order) ent.order = partial.order;
  if (isFiniteNum(partial.orderX)) ent.orderX = partial.orderX;
  if (isFiniteNum(partial.orderZ)) ent.orderZ = partial.orderZ;
  // 통째 재할당 — Goja에서 map 슬롯 in-place 필드 추가 유실 방지
  sim.entities[id] = ent;
  return sim.entities[id];
}

function bootstrapWorld(sim: MatchSim): void {
  sim.entities = {};
  eachPlayer(sim.players, function (p) {
    const bottom = p.side === "bottom";
    const hq = blockCenter(
      (MAP.width - FOOTPRINT.hq.w) / 2,
      bottom ? 0 : MAP.depth - FOOTPRINT.hq.d,
      FOOTPRINT.hq.w,
      FOOTPRINT.hq.d
    );
    const hqEnt = spawn(sim, {
        kind: "hq",
        side: p.side,
      typeId: p.race + "_hq",
      x: hq.x,
      z: hq.z,
        hp: HQ.maxHp,
        maxHp: HQ.maxHp,
      });
    if (p.race === "monster") {
      hqEnt.larva = 0;
      hqEnt.larvaAcc = 0;
      for (let i = 0; i < LARVA_CAP; i++) spawnLarva(sim, hqEnt);
    }

    // 플레이어 시점 좌측 하단. 3×3 두 개를 화면 세로(Z)로 잇는다.
    const mineralCx = bottom ? MAP.width - FOOTPRINT.mineral.w : 0;
    let mineralCz = bottom ? 0 : MAP.depth - FOOTPRINT.mineral.d;
    const mineralStep = bottom ? FOOTPRINT.mineral.d : -FOOTPRINT.mineral.d;
    for (let i = 0; i < MINERAL.startNodes; i++) {
      const node = blockCenter(
        mineralCx,
        mineralCz,
        FOOTPRINT.mineral.w,
        FOOTPRINT.mineral.d
      );
      spawn(sim, {
          kind: "mineral",
          side: p.side,
          typeId: "mineral_node",
        x: node.x,
        z: node.z,
          hp: MINERAL.nodeAmount,
          maxHp: MINERAL.nodeAmount,
        });
      mineralCz += mineralStep;
    }

    // 플레이어 시점 우측 하단. 3×3 두 개를 화면 세로(Z)로 잇는다.
    const gasCx = bottom ? 0 : MAP.width - FOOTPRINT.gas.w;
    let gasCz = bottom ? 0 : MAP.depth - FOOTPRINT.gas.d;
    const gasStep = bottom ? FOOTPRINT.gas.d : -FOOTPRINT.gas.d;
    for (let i = 0; i < GAS.startNodes; i++) {
      const node = blockCenter(
        gasCx,
        gasCz,
        FOOTPRINT.gas.w,
        FOOTPRINT.gas.d
      );
      spawn(sim, {
        kind: "gas",
        side: p.side,
        typeId: "ether_vent",
        x: node.x,
        z: node.z,
        hp: GAS.nodeAmount,
        maxHp: GAS.nodeAmount,
      });
      gasCz += gasStep;
    }

    const workerCz = bottom ? FOOTPRINT.hq.d : MAP.depth - FOOTPRINT.hq.d - 1;
    const workerCx = Math.floor(MAP.width / 2) - 1;
    for (let i = 0; i < START_WORKERS; i++) {
      const spot = cellCenter(workerCx - 1 + i * 2, workerCz);
      spawn(sim, {
          kind: "worker",
          side: p.side,
        typeId: p.race + "_worker",
        x: spot.x,
        z: spot.z,
        hp: unitMaxHp(p.race + "_worker"),
        maxHp: unitMaxHp(p.race + "_worker"),
        });
      }
    if (p.race === "monster") {
      const sac = cellCenter(workerCx + 4, workerCz);
      spawn(sim, {
        kind: "unit",
        side: p.side,
        typeId: "monster_sac",
        x: sac.x,
        z: sac.z,
        hp: unitMaxHp("monster_sac"),
        maxHp: unitMaxHp("monster_sac"),
      });
    }
  });
  fillStartingCreep(sim);
}

/** 칸 블록 [cx, cx+w) × [cz, cz+d) 의 중심. */
function blockCenter(
  cx: number,
  cz: number,
  w: number,
  d: number
): { x: number; z: number } {
  return {
    x: -WORLD.halfWidth + (cx + w / 2) * MAP.cellSize,
    z: -WORLD.halfDepth + (cz + d / 2) * MAP.cellSize,
  };
}

function blockerHalf(kind: string, typeId: string): { x: number; z: number } {
  const c = MAP.cellSize;
  if (kind === "hq") return { x: (FOOTPRINT.hq.w * c) / 2, z: (FOOTPRINT.hq.d * c) / 2 };
  if (kind === "mineral") {
    return { x: (FOOTPRINT.mineral.w * c) / 2, z: (FOOTPRINT.mineral.d * c) / 2 };
  }
  if (kind === "gas") return { x: (FOOTPRINT.gas.w * c) / 2, z: (FOOTPRINT.gas.d * c) / 2 };
  if (kind === "building") {
    const fp = footprintOf(typeId);
    return { x: (fp.w * c) / 2, z: (fp.d * c) / 2 };
  }
  return { x: c * 0.44, z: c * 0.44 };
}

function cellCenter(cx: number, cz: number): { x: number; z: number } {
  return blockCenter(cx, cz, 1, 1);
}

export function snapCell(
  x: number,
  z: number
): { cx: number; cz: number; x: number; z: number } | null {
  const cell = worldToCell(x, z);
  if (cell.cx < 0 || cell.cz < 0 || cell.cx >= MAP.width || cell.cz >= MAP.depth) {
    return null;
  }
  const center = cellCenter(cell.cx, cell.cz);
  return { cx: cell.cx, cz: cell.cz, x: center.x, z: center.z };
}

function overlapsCell(
  ex: number,
  ez: number,
  kind: string,
  typeId: string,
  cx: number,
  cz: number
): boolean {
  const center = cellCenter(cx, cz);
  const half = blockerHalf(kind, typeId);
  const limitX = half.x + MAP.cellSize / 2 - 1e-4;
  const limitZ = half.z + MAP.cellSize / 2 - 1e-4;
  return Math.abs(ex - center.x) < limitX && Math.abs(ez - center.z) < limitZ;
}

function cellBlocked(
  sim: MatchSim,
  cx: number,
  cz: number,
  ignoreId?: string | null
): boolean {
  let blocked = false;
  eachEntity(sim.entities, function (e) {
    if (blocked) return;
    if (ignoreId && e.id === ignoreId) return;
    if (e.kind === "worker" && e.morphBuild && isFiniteNum(e.morphX) && isFiniteNum(e.morphZ)) {
      if (overlapsCell(e.morphX, e.morphZ, "building", e.morphBuild, cx, cz)) {
        blocked = true;
      }
      return;
    }
    if (
      e.kind !== "building" &&
      e.kind !== "hq" &&
      e.kind !== "mineral" &&
      e.kind !== "gas" &&
      e.kind !== "unit" &&
      e.kind !== "worker" &&
      e.kind !== "larva" &&
      e.kind !== "egg"
    ) {
      return;
    }
    if (overlapsCell(e.x, e.z, e.kind, e.typeId, cx, cz)) blocked = true;
  });
  return blocked;
}

function needsPylonPower(def: { race: string; typeId: string }): boolean {
  // 융합탑은 분출구 위라면 동력탑 범위 밖에도 짓는다.
  return (
    def.race === "alien" &&
    def.typeId !== "alien_pylon" &&
    def.typeId !== "alien_assimilator"
  );
}

function cellPowered(sim: MatchSim, side: Side, cx: number, cz: number): boolean {
  let ok = false;
  const center = cellCenter(cx, cz);
  eachEntity(sim.entities, function (e) {
    if (ok) return;
    if (e.side !== side || e.typeId !== "alien_pylon" || e.hp <= 0) return;
    if (cellInPylonPower(e.x, e.z, center.x, center.z, MAP.cellSize)) ok = true;
  });
  return ok;
}

/**
 * 배치 좌표는 발자국 기하 중심이다.
 * 짝수 칸은 중심이 격자선 위에 있어 floor 스냅하면 한 칸 밀린다.
 */
function originFromCenter(
  x: number,
  z: number,
  w: number,
  d: number
): { cx: number; cz: number } {
  return {
    cx: Math.round((x + WORLD.halfWidth) / MAP.cellSize - w / 2),
    cz: Math.round((z + WORLD.halfDepth) / MAP.cellSize - d / 2),
  };
}

function footprintPowered(
  sim: MatchSim,
  side: Side,
  ox: number,
  oz: number,
  w: number,
  d: number
): boolean {
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      if (!cellPowered(sim, side, ox + dx, oz + dz)) return false;
    }
  }
  return true;
}

function placeBuilding(
  sim: MatchSim,
    player: SimPlayer,
    buildingType: string,
    x: number,
  z: number,
  workerId: string
  ): void {
  const def = buildingDef(buildingType);
  if (!def || def.race !== player.race) return;
  if (player.energy < def.costE || player.minerals < def.costM) return;
  if (def.needs && !hasReady(sim, player.side, def.needs)) return;

  const worker = sim.entities[workerId];
  if (!worker || worker.kind !== "worker" || worker.side !== player.side) {
    return;
  }

  const prevBuild = worker.morphBuild;
  const prevX = worker.morphX;
  const prevZ = worker.morphZ;
  const prevBusy = worker.busyOn;
  const prevCorner = worker.buildCorner;
  const prevWait = worker.buildWait;
  abandonBuild(worker);

  const origin = originFromCenter(x, z, def.w, def.d);
  const spotOk =
    origin != null &&
    (def.role === "gas"
      ? etherFootprintFree(
          sim,
          player.side,
          origin.cx,
          origin.cz,
          def.w,
          def.d,
          workerId
        )
      : footprintFree(
          sim,
          player.side,
          origin.cx,
          origin.cz,
          def.w,
          def.d,
          workerId
        )) &&
    (!needsPylonPower(def) ||
      footprintPowered(sim, player.side, origin.cx, origin.cz, def.w, def.d)) &&
    (!buildingNeedsCreep(def.typeId) ||
      footprintOnCreep(sim, origin.cx, origin.cz, def.w, def.d));
  if (!origin || !spotOk) {
    if (prevBuild) worker.morphBuild = prevBuild;
    if (isFiniteNum(prevX)) worker.morphX = prevX;
    if (isFiniteNum(prevZ)) worker.morphZ = prevZ;
    if (prevBusy) worker.busyOn = prevBusy;
    if (typeof prevCorner === "number") worker.buildCorner = prevCorner;
    if (typeof prevWait === "number") worker.buildWait = prevWait;
    return;
  }

  clearHarvest(sim, worker);
  clearOrder(worker);

  const center = blockCenter(origin.cx, origin.cz, def.w, def.d);
  // 세 종족 모두 일꾼이 지점에 도착한 뒤 건설·변태·소환을 시작한다.
  worker.morphBuild = def.typeId;
  worker.morphX = center.x;
  worker.morphZ = center.z;
  const stop = 0.28;
  if (dist2(worker.x, worker.z, center.x, center.z) <= stop * stop) {
    finishPendingBuild(sim, worker);
    return;
  }
  worker.order = "move";
  worker.orderX = center.x;
  worker.orderZ = center.z;
  replaceEntity(sim, worker);
}

function footprintFree(
  sim: MatchSim,
  side: Side,
  ox: number,
  oz: number,
  w: number,
  d: number,
  ignoreId?: string | null
): boolean {
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const cx = ox + dx;
      const cz = oz + dz;
      if (cx < 0 || cz < 0 || cx >= MAP.width || cz >= MAP.depth) return false;
      const center = cellCenter(cx, cz);
      if (!inBuildZone(side, center.x, center.z)) return false;
      if (cellBlocked(sim, cx, cz, ignoreId)) return false;
    }
  }
  return true;
}

/** 에테르 분출구(3×3)와 발자국이 정확히 같을 때만. 분출구당 건물 하나. */
function etherFootprintFree(
  sim: MatchSim,
  side: Side,
  ox: number,
  oz: number,
  w: number,
  d: number,
  ignoreId?: string | null
): boolean {
  if (w !== FOOTPRINT.gas.w || d !== FOOTPRINT.gas.d) return false;
  let matched = false;
  eachEntity(sim.entities, function (e) {
    if (matched) return;
    if (e.kind !== "gas" || e.side !== side || e.hp <= 0) return;
    const c = worldToCell(e.x, e.z);
    const gx = c.cx - Math.floor((FOOTPRINT.gas.w - 1) / 2);
    const gz = c.cz - Math.floor((FOOTPRINT.gas.d - 1) / 2);
    if (gx === ox && gz === oz) matched = true;
  });
  if (!matched) return false;
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const cx = ox + dx;
      const cz = oz + dz;
      if (cx < 0 || cz < 0 || cx >= MAP.width || cz >= MAP.depth) return false;
      if (cellBlockedExceptGas(sim, cx, cz, ignoreId)) return false;
    }
  }
  return true;
}

function cellBlockedExceptGas(
  sim: MatchSim,
  cx: number,
  cz: number,
  ignoreId?: string | null
): boolean {
  let blocked = false;
  eachEntity(sim.entities, function (e) {
    if (blocked) return;
    if (ignoreId && e.id === ignoreId) return;
    if (e.kind === "worker" && e.morphBuild && isFiniteNum(e.morphX) && isFiniteNum(e.morphZ)) {
      if (overlapsCell(e.morphX, e.morphZ, "building", e.morphBuild, cx, cz)) {
        blocked = true;
      }
      return;
    }
    if (
      e.kind !== "building" &&
      e.kind !== "hq" &&
      e.kind !== "mineral" &&
      e.kind !== "unit" &&
      e.kind !== "worker" &&
      e.kind !== "larva" &&
      e.kind !== "egg"
    ) {
      return;
    }
    if (overlapsCell(e.x, e.z, e.kind, e.typeId, cx, cz)) blocked = true;
  });
  return blocked;
}

function isGasBuilding(e: SimEntity): boolean {
  if (e.kind !== "building") return false;
  const def = buildingDef(e.typeId);
  return !!def && def.role === "gas";
}

/** 에테르 건물과 같은 중심의 분출구. */
function ventUnder(sim: MatchSim, building: SimEntity): SimEntity | null {
  let found: SimEntity | null = null;
  eachEntity(sim.entities, function (e) {
    if (found) return;
    if (e.kind !== "gas" || e.hp <= 0) return;
    const dx = e.x - building.x;
    const dz = e.z - building.z;
    if (dx * dx + dz * dz <= 0.04) found = e;
  });
  return found;
}

function workerInsideGas(e: SimEntity): boolean {
  return e.harvestSource === "gas" && e.harvestPhase === "mining";
}

/** 건물 한가운데에 끼어 있으면 가장 가까운 빈 칸으로 바로 꺼낸다. */
function standOutside(sim: MatchSim, worker: SimEntity): void {
  const spot = nearestOpenStand(sim, worker);
  if (spot) {
    worker.x = spot.x;
    worker.z = spot.z;
  }
}

/** 건물 안에 있으면 밖으로 내보낸 뒤 채취를 끊는다. */
function clearHarvest(sim: MatchSim, e: SimEntity): void {
  const inside = workerInsideGas(e);
  delete e.harvestPhase;
  delete e.harvestMineralId;
  delete e.harvestHqId;
  delete e.harvestSource;
  delete e.carryKind;
  delete e.mineLeft;
  e.carry = 0;
  if (inside) standOutside(sim, e);
  replaceEntity(sim, e);
}

function clearNav(e: SimEntity): void {
  delete e.slideSign;
  delete e.slideHold;
  delete e.navBest;
  delete e.navStuck;
  delete e.navXs;
  delete e.navZs;
  delete e.navI;
  delete e.navGX;
  delete e.navGZ;
  delete e.navLineOk;
  delete e.navLineRev;
  delete e.navFar;
  delete e.navFarRev;
}

function clearOrder(e: SimEntity): void {
  delete e.order;
  delete e.orderX;
  delete e.orderZ;
  delete e.orderTargetId;
  delete e.orderTick;
  delete e.approachX;
  delete e.approachZ;
  delete e.attackCd;
  clearNav(e);
}

/** Goja 호환 — Number.isFinite 미존재 환경에서도 안전. */
function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && n === n && n !== Infinity && n !== -Infinity;
}

/**
 * Goja/Nakama: 중첩 객체 필드 in-place 수정이 유실될 수 있어
 * 엔티티를 새 객체로 만들어 map에 다시 넣는다.
 */
function replaceEntity(sim: MatchSim, e: SimEntity): SimEntity {
  const next: SimEntity = {
    id: e.id,
    kind: e.kind,
    side: e.side,
    typeId: e.typeId,
    x: e.x,
    z: e.z,
    hp: e.hp,
    maxHp: e.maxHp,
  };
  if (isFiniteNum(e.rallyX)) next.rallyX = e.rallyX;
  if (isFiniteNum(e.rallyZ)) next.rallyZ = e.rallyZ;
  if (e.constructing) next.constructing = true;
  if (typeof e.buildLeft === "number") next.buildLeft = e.buildLeft;
  if (typeof e.buildSec === "number") next.buildSec = e.buildSec;
  if (typeof e.larva === "number") next.larva = e.larva;
  if (typeof e.larvaAcc === "number") next.larvaAcc = e.larvaAcc;
  if (e.queue && e.queue.length) next.queue = copyStrArr(e.queue);
  if (typeof e.prodLeft === "number") next.prodLeft = e.prodLeft;
  if (e.morphType) next.morphType = e.morphType;
  if (typeof e.morphLeft === "number") next.morphLeft = e.morphLeft;
  if (typeof e.morphSec === "number") next.morphSec = e.morphSec;
  if (e.hatchOf) next.hatchOf = e.hatchOf;
  if (e.busyOn) next.busyOn = e.busyOn;
  if (e.morphBuild) next.morphBuild = e.morphBuild;
  if (isFiniteNum(e.morphX)) next.morphX = e.morphX;
  if (isFiniteNum(e.morphZ)) next.morphZ = e.morphZ;
  if (typeof e.buildCorner === "number") next.buildCorner = e.buildCorner;
  if (typeof e.buildWait === "number") next.buildWait = e.buildWait;
  if (isFiniteNum(e.ejectX)) next.ejectX = e.ejectX;
  if (isFiniteNum(e.ejectZ)) next.ejectZ = e.ejectZ;
  if (e.harvestPhase) next.harvestPhase = e.harvestPhase;
  if (e.harvestMineralId) next.harvestMineralId = e.harvestMineralId;
  if (e.harvestHqId) next.harvestHqId = e.harvestHqId;
  if (e.harvestSource) next.harvestSource = e.harvestSource;
  if (e.carryKind) next.carryKind = e.carryKind;
  if (typeof e.carry === "number") next.carry = e.carry;
  if (typeof e.mineLeft === "number") next.mineLeft = e.mineLeft;
  if (e.order) next.order = e.order;
  if (isFiniteNum(e.orderX)) next.orderX = e.orderX;
  if (isFiniteNum(e.orderZ)) next.orderZ = e.orderZ;
  if (e.orderTargetId) next.orderTargetId = e.orderTargetId;
  if (typeof e.orderTick === "number") next.orderTick = e.orderTick;
  if (isFiniteNum(e.approachX)) next.approachX = e.approachX;
  if (isFiniteNum(e.approachZ)) next.approachZ = e.approachZ;
  if (typeof e.attackCd === "number") next.attackCd = e.attackCd;
  if (e.homeId) next.homeId = e.homeId;
  if (e.kind === "larva") {
    if (typeof e.crawlHeading === "number") next.crawlHeading = e.crawlHeading;
    if (typeof e.crawlTangent === "number") next.crawlTangent = e.crawlTangent;
    if (typeof e.crawlSpeed === "number") next.crawlSpeed = e.crawlSpeed;
    if (typeof e.crawlFlip === "number") next.crawlFlip = e.crawlFlip;
  }
  if (e.slideSign === 1 || e.slideSign === -1) next.slideSign = e.slideSign;
  if (typeof e.slideHold === "number") next.slideHold = e.slideHold;
  if (typeof e.navBest === "number") next.navBest = e.navBest;
  if (typeof e.navStuck === "number") next.navStuck = e.navStuck;
  if (e.navXs) {
    const xs: number[] = [];
    const zs: number[] = [];
    const srcZ = e.navZs || [];
    for (let i = 0; i < e.navXs.length; i++) {
      xs.push(e.navXs[i]);
      zs.push(srcZ[i]);
    }
    next.navXs = xs;
    next.navZs = zs;
  }
  if (typeof e.navI === "number") next.navI = e.navI;
  if (isFiniteNum(e.navGX)) next.navGX = e.navGX;
  if (isFiniteNum(e.navGZ)) next.navGZ = e.navGZ;
  if (e.navLineOk === 0 || e.navLineOk === 1) next.navLineOk = e.navLineOk;
  if (typeof e.navLineRev === "number") next.navLineRev = e.navLineRev;
  if (typeof e.navFar === "number") next.navFar = e.navFar;
  if (typeof e.navFarRev === "number") next.navFarRev = e.navFarRev;
  if (typeof e.movedTick === "number") next.movedTick = e.movedTick;
  sim.entities[e.id] = next;
  return next;
}

function setRallyPoint(
  sim: MatchSim,
  player: SimPlayer,
  buildingId: string,
  x: unknown,
  z: unknown
): void {
  const b = sim.entities[buildingId];
  if (!b || b.side !== player.side) return;
  if (b.kind !== "building" && b.kind !== "hq") return;
  const rx = typeof x === "number" ? x : Number(x);
  const rz = typeof z === "number" ? z : Number(z);
  if (!isFiniteNum(rx) || !isFiniteNum(rz)) return;
  b.rallyX = rx;
  b.rallyZ = rz;
  replaceEntity(sim, b);
}

function clearRallyPoint(
  sim: MatchSim,
  player: SimPlayer,
  buildingId: string
): void {
  const b = sim.entities[buildingId];
  if (!b || b.side !== player.side) return;
  if (b.kind !== "building" && b.kind !== "hq") return;
  delete b.rallyX;
  delete b.rallyZ;
  replaceEntity(sim, b);
}

/** 해병 기준. 나머지 속도·사거리·공속은 스타1 패스티스트 비율. 이동만 MOVE_SPEED_SCALE. */
const MARINE_SPEED = 1.9 * MOVE_SPEED_SCALE;
const MARINE_RANGE = 2.4;
const MARINE_PERIOD = 0.75;
/** 화염방사병 스플래시 반경(월드). 주 목표 제외 지상 적에게 절반 피해. */
const FIREBAT_SPLASH = MARINE_RANGE * 0.35;
/**
 * 피격 대응이 퍼지는 거리(월드).
 * 맞은 자리 이 반경 안의 대기 중인 아군이 같은 적을 공격한다.
 * 해병 사거리(2.4)보다 조금 넓어, 붙어 있는 분대는 함께 움직인다.
 */
const RETALIATE_RADIUS = 3;
/** 기동포 위상포. 중심에서 나가 대상 중심에 닿을 때 피해가 들어간다. */
const DRAGOON_BOLT_SPEED = 7;
const DRAGOON_BOLT_TYPE = "fx_bolt_alien_dragoon";

interface SimBolt {
  id: string;
  side: Side;
  typeId: string;
  x: number;
  z: number;
  tx: number;
  tz: number;
  targetId: string;
  damage: number;
  attackerId: string;
  attackerTypeId: string;
  /** 이 틱에 발사됨. 같은 틱에는 중심에서 움직이지 않는다. */
  born: number;
  /** 1이면 이번 스냅샷에 착탄 위치를 보여 주고 다음 틱에 지운다. */
  impact: number;
}

function combatProfile(typeId: string): {
  speed: number;
  range: number;
  damage: number;
  period: number;
} {
  // 칼날충: 속도 5.49/4, 공속 원본 8/15. 사거리는 weaponRange 가 몸통 접촉으로 덮는다.
  if (typeId.indexOf("blade") >= 0) {
    return {
      speed: MARINE_SPEED * (5.49 / 4),
      range: MARINE_RANGE / 4,
      damage: 5,
      period: MARINE_PERIOD * (8 / 15),
    };
  }
  // 화염방사병: 사거리 2/5, 피해 8+8, 공속 22/15
  if (typeId === "human_firebat") {
    return {
      speed: MARINE_SPEED,
      range: MARINE_RANGE * (2 / 5),
      damage: 16,
      period: MARINE_PERIOD * (22 / 15),
    };
  }
  // 의무관: 공격 없음
  if (typeId === "human_medic") {
    return {
      speed: MARINE_SPEED,
      range: MARINE_RANGE / 4,
      damage: 0,
      period: MARINE_PERIOD,
    };
  }
  // 독침충: 속도 3.66/4, 사거리 해병과 동일, 피해 10
  if (typeId === "monster_hydra") {
    return {
      speed: MARINE_SPEED * (3.66 / 4),
      range: MARINE_RANGE,
      damage: 10,
      period: MARINE_PERIOD,
    };
  }
  // 돌격전사: 소총병과 같은 속도, 공속 22/15, 피해 8×2. 사거리는 weaponRange 가 몸통 접촉으로 덮는다.
  if (typeId.indexOf("guardian") >= 0) {
    return {
      speed: MARINE_SPEED,
      range: MARINE_RANGE / 6,
      damage: 16,
      period: MARINE_PERIOD * (22 / 15),
    };
  }
  // 기동포: 속도 5.25/4, 사거리 4/5, 피해 20, 공속 30/15
  if (typeId === "alien_dragoon") {
    return {
      speed: MARINE_SPEED * (5.25 / 4),
      range: MARINE_RANGE * (4 / 5),
      damage: 20,
      period: MARINE_PERIOD * (30 / 15),
    };
  }
  // 관측체: 0.832/4. 공격 없음.
  if (typeId === "monster_sac") {
    return {
      speed: MARINE_SPEED * (0.832 / 4),
      range: MARINE_RANGE / 4,
      damage: 0,
      period: MARINE_PERIOD,
    };
  }
  // 공병기: 소총병과 같은 공속(원본 15). 집게충·탐사기는 22.
  if (typeId === "human_worker") {
    return {
      speed: WORKER_SPEED,
      range: MARINE_RANGE / 4,
      damage: 5,
      period: MARINE_PERIOD,
    };
  }
  if (typeId.indexOf("worker") >= 0) {
    return {
      speed: WORKER_SPEED,
      range: MARINE_RANGE / 4,
      damage: 5,
      period: MARINE_PERIOD * (22 / 15),
    };
  }
  return {
    speed: MARINE_SPEED,
    range: MARINE_RANGE,
    damage: 6,
    period: MARINE_PERIOD,
  };
}

/** 스타1과 같은 체력. 탐사기·돌격전사·기동포는 보호막 포함 총합. */
function unitMaxHp(typeId: string): number {
  if (typeId === "human_worker") return 60;
  if (typeId === "human_firebat") return 50;
  if (typeId === "human_medic") return 60;
  if (typeId === "monster_sac") return 200;
  if (typeId === "monster_hydra") return 80;
  if (typeId.indexOf("guardian") >= 0) return 160;
  if (typeId === "alien_dragoon") return 180;
  if (typeId.indexOf("blade") >= 0) return 35;
  return 40;
}

/** 스타1 대공: 해병·히드라·기동포. */
function attacksAir(typeId: string): boolean {
  return (
    typeId === "human_rifleman" ||
    typeId === "monster_hydra" ||
    typeId === "alien_dragoon"
  );
}

function canCommandUnit(e: SimEntity): boolean {
  return e.kind === "unit" || e.kind === "worker";
}

function isConstructBusy(sim: MatchSim, unit: SimEntity): boolean {
  if (unit.morphBuild) return true;
  if (!unit.busyOn) return false;
  const site = sim.entities[unit.busyOn];
  return !!(site && site.constructing);
}

function spawnConstructing(
  sim: MatchSim,
  side: Side,
  def: { typeId: string; hp: number; buildSec: number },
  x: number,
  z: number
): SimEntity {
  const built = spawn(sim, {
    kind: "building",
    side: side,
    typeId: def.typeId,
    x: x,
    z: z,
    hp: 1,
    maxHp: def.hp,
  });
  built.constructing = true;
  built.buildSec = def.buildSec;
  built.buildLeft = def.buildSec;
  return built;
}

/**
 * 일꾼이 건설 지점에 도착한 뒤 명령을 실행한다.
 * morph: 집게충 소모 후 건설. worker: 그 자리에서 건설. warp: 건물 소환 후 일꾼 해제.
 */
function spendCost(player: SimPlayer, minerals: number, ether: number): void {
  player.minerals -= minerals;
  player.energy -= ether;
  if (minerals > 0) player.mineralsSpent = (player.mineralsSpent || 0) + minerals;
  if (ether > 0) player.etherSpent = (player.etherSpent || 0) + ether;
}

function refundCost(player: SimPlayer, minerals: number, ether: number): void {
  const room = Math.max(0, ENERGY.max - player.energy);
  const etherBack = ether < room ? ether : room;
  player.energy += etherBack;
  player.minerals += minerals;
  player.mineralsSpent = Math.max(0, (player.mineralsSpent || 0) - minerals);
  player.etherSpent = Math.max(0, (player.etherSpent || 0) - etherBack);
}

function depositCarry(player: SimPlayer, carry: number, gas: boolean): void {
  if (carry <= 0) return;
  if (gas) {
    player.energy += carry;
    player.etherGained = (player.etherGained || 0) + carry;
    return;
  }
  player.minerals += carry;
  player.mineralsGained = (player.mineralsGained || 0) + carry;
}

function noteUnitsMade(sim: MatchSim, side: Side, count: number): void {
  if (count <= 0) return;
  const owner = findPlayerBySide(sim, side);
  if (!owner) return;
  owner.unitsMade = (owner.unitsMade || 0) + count;
}

function payForBuilding(sim: MatchSim, side: Side, typeId: string): boolean {
  const def = buildingDef(typeId);
  const owner = findPlayerBySide(sim, side);
  if (!def || !owner) return false;
  if (owner.energy < def.costE || owner.minerals < def.costM) return false;
  spendCost(owner, def.costM, def.costE);
  return true;
}

/** 진행 중인 건설 이동·시공을 놓는다. 아직 차감 전이면 환불할 자원이 없다. */
function abandonBuild(worker: SimEntity): void {
  delete worker.morphBuild;
  delete worker.morphX;
  delete worker.morphZ;
  delete worker.busyOn;
  delete worker.buildCorner;
  delete worker.buildWait;
}

function cancelPendingBuild(sim: MatchSim, worker: SimEntity): void {
  delete worker.morphBuild;
  delete worker.morphX;
  delete worker.morphZ;
  clearOrder(worker);
  replaceEntity(sim, worker);
}

function finishPendingBuild(sim: MatchSim, worker: SimEntity): void {
  const typeId = worker.morphBuild || "";
  const x = worker.morphX;
  const z = worker.morphZ;
  const side = worker.side;
  const def = buildingDef(typeId);
  if (!def || !isFiniteNum(x) || !isFiniteNum(z)) {
    cancelPendingBuild(sim, worker);
    return;
  }
  const origin = originFromCenter(x, z, def.w, def.d);
  if (
    buildingNeedsCreep(typeId) &&
    !footprintOnCreep(sim, origin.cx, origin.cz, def.w, def.d)
  ) {
    cancelPendingBuild(sim, worker);
    return;
  }
  if (
    needsPylonPower(def) &&
    !footprintPowered(sim, side, origin.cx, origin.cz, def.w, def.d)
  ) {
    cancelPendingBuild(sim, worker);
    return;
  }
  if (!payForBuilding(sim, side, typeId)) {
    cancelPendingBuild(sim, worker);
    return;
  }
  if (def.method === "morph") {
    delete sim.entities[worker.id];
    spawnConstructing(sim, side, def, x, z);
    refreshOccupancy(sim);
    return;
  }
  const built = spawnConstructing(sim, side, def, x, z);
  delete worker.morphBuild;
  delete worker.morphX;
  delete worker.morphZ;
  clearOrder(worker);
  if (def.method === "worker") {
    worker.busyOn = built.id;
    worker.buildCorner = Math.floor(Math.random() * 4);
  }
  replaceEntity(sim, worker);
  refreshOccupancy(sim);
}

/** 한 클릭으로 모일 때 몸통이 겹치지 않는 최소 간격. */
const GATHER_GAP2 = 0.46 * 0.46;

function gatherReserved(
  sim: MatchSim,
  ent: SimEntity,
  tx: number,
  tz: number,
  xs: number[],
  zs: number[]
): void {
  eachEntity(sim.entities, function (e) {
    if (e.id === ent.id || e.side !== ent.side) return;
    if (e.orderTick !== sim.tick) return;
    if (e.order !== "move" && e.order !== "attack_move") return;
    if (!isFiniteNum(e.orderX) || !isFiniteNum(e.orderZ)) return;
    if (dist2(e.orderX, e.orderZ, tx, tz) > 4) return;
    xs.push(e.orderX);
    zs.push(e.orderZ);
  });
}

function gatherTooClose(x: number, z: number, xs: number[], zs: number[]): boolean {
  for (let i = 0; i < xs.length; i++) {
    if (dist2(x, z, xs[i], zs[i]) < GATHER_GAP2) return true;
  }
  return false;
}

/** 칸 안에서 목표에 가장 가까운 점. 경계는 이웃 칸으로 넘어가지 않게 당긴다. */
function closestInCell(
  cx: number,
  cz: number,
  tx: number,
  tz: number
): { x: number; z: number } {
  const c = cellCenter(cx, cz);
  const h = MAP.cellSize * 0.5 - 0.02;
  let x = tx;
  let z = tz;
  if (x < c.x - h) x = c.x - h;
  else if (x > c.x + h) x = c.x + h;
  if (z < c.z - h) z = c.z - h;
  else if (z > c.z + h) z = c.z + h;
  return { x: x, z: z };
}

function searchGather(
  sim: MatchSim,
  ent: SimEntity,
  tx: number,
  tz: number,
  rx: number[],
  rz: number[],
  maxR: number
): { x: number; z: number } | null {
  let bestX = 0;
  let bestZ = 0;
  let bestD = 1e18;
  let found = false;
  function consider(x: number, z: number): void {
    if (gatherTooClose(x, z, rx, rz)) return;
    if (!canStand(sim, ent, x, z)) return;
    const d = dist2(x, z, tx, tz);
    if (!found || d < bestD) {
      found = true;
      bestD = d;
      bestX = x;
      bestZ = z;
    }
  }
  const clamped = clampMap(tx, tz, mapPad(ent));
  consider(clamped.x, clamped.z);
  const g = worldToCell(tx, tz);
  const w = MAP.width;
  const depth = MAP.depth;
  for (let r = 0; r <= maxR; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (r > 0 && Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const cx = g.cx + dx;
        const cz = g.cz + dz;
        if (cx < 0 || cz < 0 || cx >= w || cz >= depth) continue;
        const p = closestInCell(cx, cz, tx, tz);
        consider(p.x, p.z);
      }
    }
  }
  if (!found) return null;
  return { x: bestX, z: bestZ };
}

/** 클릭 지점에 설 수 있으면 그곳, 아니면 가장 가까운 빈 자리. 같은 명령의 아군과는 겹치지 않는다. */
function gatherPoint(
  sim: MatchSim,
  ent: SimEntity,
  tx: number,
  tz: number
): { x: number; z: number } {
  refreshOccupancy(sim);
  const rx: number[] = [];
  const rz: number[] = [];
  gatherReserved(sim, ent, tx, tz, rx, rz);
  const near = searchGather(sim, ent, tx, tz, rx, rz, 16);
  if (near) return near;
  const any = searchGather(sim, ent, tx, tz, [], [], 18);
  if (any) return any;
  return clampMap(tx, tz, mapPad(ent));
}

function orderMove(
  sim: MatchSim,
  player: SimPlayer,
  unitId: string,
  x: number,
  z: number
): void {
  const unit = sim.entities[unitId];
  if (!unit || unit.side !== player.side || !canCommandUnit(unit)) return;
  abandonBuild(unit);
  clearHarvest(sim, unit);
  unit.order = "move";
  const dest = gatherPoint(sim, unit, x, z);
  unit.orderX = dest.x;
  unit.orderZ = dest.z;
  unit.orderTick = sim.tick;
  delete unit.orderTargetId;
  delete unit.attackCd;
  clearNav(unit);
  replaceEntity(sim, unit);
}

function isAttackTargetKind(target: SimEntity): boolean {
  return (
    target.kind === "unit" ||
    target.kind === "worker" ||
    target.kind === "building" ||
    target.kind === "hq"
  );
}

/** 자동 교전. 적 유닛·건물만. */
function isAttackableTarget(attacker: SimEntity, target: SimEntity): boolean {
  if (!target || target.id === attacker.id || target.hp <= 0) return false;
  if (target.side === attacker.side) return false;
  if (!isAttackTargetKind(target)) return false;
  if (isAirUnit(target.typeId) && !attacksAir(attacker.typeId)) return false;
  return true;
}

/** 클릭으로 지정한 공격. 아군·적 유닛과 건물. */
function isCommandAttackTarget(attacker: SimEntity, target: SimEntity): boolean {
  if (!target || target.id === attacker.id || target.hp <= 0) return false;
  if (!isAttackTargetKind(target)) return false;
  if (isAirUnit(target.typeId) && !attacksAir(attacker.typeId)) return false;
  return true;
}

function orderAttack(
  sim: MatchSim,
  player: SimPlayer,
  unitId: string,
  targetId: string
): void {
  const unit = sim.entities[unitId];
  const target = sim.entities[targetId];
  if (!unit || unit.side !== player.side || !canCommandUnit(unit)) return;
  if (!target || !isCommandAttackTarget(unit, target)) return;
  abandonBuild(unit);
  clearHarvest(sim, unit);
  unit.order = "attack";
  unit.orderTargetId = target.id;
  delete unit.orderX;
  delete unit.orderZ;
  unit.attackCd = 0;
  clearNav(unit);
  replaceEntity(sim, unit);
}

function orderAttackMove(
  sim: MatchSim,
  player: SimPlayer,
  unitId: string,
  x: number,
  z: number
): void {
  const unit = sim.entities[unitId];
  if (!unit || unit.side !== player.side || !canCommandUnit(unit)) return;
  abandonBuild(unit);
  clearHarvest(sim, unit);
  unit.order = "attack_move";
  const dest = gatherPoint(sim, unit, x, z);
  unit.orderX = dest.x;
  unit.orderZ = dest.z;
  unit.orderTick = sim.tick;
  delete unit.orderTargetId;
  unit.attackCd = 0;
  clearNav(unit);
  replaceEntity(sim, unit);
}

/** 유휴 유닛이 무기 사거리 안에서 고를 가장 가까운 적. */
function findIdleTarget(sim: MatchSim, attacker: SimEntity, range: number): SimEntity | null {
  let best: SimEntity | null = null;
  let bestD = 1e9;
  eachEntity(sim.entities, function (e) {
    if (e.side === attacker.side) return;
    if (!isAttackableTarget(attacker, e)) return;
    if (!targetInWeaponRange(attacker, e, range)) return;
    const d = engageDistance(attacker, e);
    if (d <= bestD) {
      bestD = d;
      best = e;
    }
  });
  return best;
}

/** 교전 거리. 건물·HQ는 중심이 아니라 발자국 가장자리까지. */
function engageDistance(attacker: SimEntity, target: SimEntity): number {
  if (target.kind === "building" || target.kind === "hq") {
    return distToFootprint(attacker.x, attacker.z, target);
  }
  return Math.sqrt(dist2(attacker.x, attacker.z, target.x, target.z));
}

function findEngageTarget(
  sim: MatchSim,
  attacker: SimEntity,
  range: number
): SimEntity | null {
  let best: SimEntity | null = null;
  let bestD = 1e9;
  eachEntity(sim.entities, function (e) {
    if (e.side === attacker.side) return;
    if (!isAttackableTarget(attacker, e)) return;
    const d = engageDistance(attacker, e);
    if (d > weaponRange(attacker, e, range)) return;
    if (d <= bestD) {
      bestD = d;
      best = e;
    }
  });
  return best;
}

/** Goja는 객체에 넣은 배열에 push 하지 못한다. 복사한 새 배열을 다시 넣는다. */
function noteHit(
  sim: MatchSim,
  target: SimEntity,
  attackerId: string,
  attackerTypeId: string,
  damage: number
): void {
  if (damage <= 0) return;
  const prev = sim.hits;
  const next: HitSnap[] = [];
  if (prev) {
    const n = prev.length;
    for (let i = 0; i < n; i++) next.push(prev[i]);
  }
  const hit: HitSnap = {
    x: target.x,
    z: target.z,
    attackerId: attackerId,
    attackerTypeId: attackerTypeId,
    damage: damage,
    side: target.side,
  };
  if (
    target.kind === "unit" ||
    target.kind === "worker" ||
    target.kind === "larva" ||
    target.kind === "egg"
  ) {
    hit.lift = 1;
  }
  next.push(hit);
  sim.hits = next;
  queueRetaliation(sim, target, attackerId);
}

function queueRetaliation(
  sim: MatchSim,
  victim: SimEntity,
  attackerId: string
): void {
  if (victim.kind !== "unit" && victim.kind !== "worker") return;
  const attacker = sim.entities[attackerId];
  if (!attacker || attacker.hp <= 0 || attacker.side === victim.side) return;
  const prev = sim.retaliations;
  const next: Retaliation[] = [];
  if (prev) {
    const n = prev.length;
    for (let i = 0; i < n; i++) next.push(prev[i]);
  }
  next.push({
    victimId: victim.id,
    attackerId: attackerId,
    x: victim.x,
    z: victim.z,
    side: victim.side,
  });
  sim.retaliations = next;
}

/** 맞은 유닛은 이동을 끊고 반격한다. 주변 아군은 명령이 없을 때만 함께 붙는다. */
function tryRetaliate(
  sim: MatchSim,
  unit: SimEntity,
  attacker: SimEntity,
  victimSelf: boolean
): void {
  if (!canCommandUnit(unit) || unit.hp <= 0) return;
  if (unit.harvestPhase || unit.morphBuild || unit.busyOn) return;
  if (isConstructBusy(sim, unit)) return;
  if (combatProfile(unit.typeId).damage <= 0) return;
  if (!isAttackableTarget(unit, attacker)) return;
  if (unit.orderTargetId === attacker.id && unit.order) return;
  if (unit.order === "attack" && unit.orderTargetId) {
    const cur = sim.entities[unit.orderTargetId];
    if (cur && cur.hp > 0) return;
  }
  if (!victimSelf && unit.order) return;
  unit.order = "attack";
  unit.orderTargetId = attacker.id;
  delete unit.orderX;
  delete unit.orderZ;
  clearNav(unit);
  replaceEntity(sim, unit);
}

function applyRetaliations(sim: MatchSim): void {
  const src = sim.retaliations;
  delete sim.retaliations;
  if (!src || src.length === 0) return;
  const r2 = RETALIATE_RADIUS * RETALIATE_RADIUS;
  const n = src.length;
  for (let i = 0; i < n; i++) {
    const ev = src[i];
    const attacker = sim.entities[ev.attackerId];
    if (!attacker || attacker.hp <= 0 || attacker.side === ev.side) continue;
    const victim = sim.entities[ev.victimId];
    if (victim && victim.hp > 0) tryRetaliate(sim, victim, attacker, true);
    eachEntity(sim.entities, function (ally) {
      if (ally.side !== ev.side || ally.hp <= 0) return;
      if (ally.id === ev.victimId) return;
      if (dist2(ally.x, ally.z, ev.x, ev.z) > r2) return;
      tryRetaliate(sim, ally, attacker, false);
    });
  }
}

function pushBolt(sim: MatchSim, bolt: SimBolt): void {
  const prev = sim.bolts;
  const next: SimBolt[] = [];
  if (prev) {
    const n = prev.length;
    for (let i = 0; i < n; i++) next.push(prev[i]);
  }
  next.push(bolt);
  sim.bolts = next;
}

function boltCanHit(bolt: SimBolt, target: SimEntity): boolean {
  // 클릭으로 쏜 위상포는 아군 유닛·건물에도 맞는다.
  if (target.hp <= 0 || target.id === bolt.attackerId) return false;
  if (!isAttackTargetKind(target)) return false;
  if (isAirUnit(target.typeId) && !attacksAir(bolt.attackerTypeId)) return false;
  return true;
}

/** 기동포 위상포를 유닛 중심에 만든다. 피해는 착탄 틱에 넣는다. */
function launchDragoonBolt(
  sim: MatchSim,
  attacker: SimEntity,
  target: SimEntity,
  damage: number
): void {
  const bolt: SimBolt = {
    id: "p" + sim.nextId++,
    side: attacker.side,
    typeId: DRAGOON_BOLT_TYPE,
    x: attacker.x,
    z: attacker.z,
    tx: target.x,
    tz: target.z,
    targetId: target.id,
    damage: damage,
    attackerId: attacker.id,
    attackerTypeId: attacker.typeId,
    born: sim.tick,
    impact: 0,
  };
  pushBolt(sim, bolt);
}

function tickDragoonBolts(sim: MatchSim, dead: string[]): void {
  const src = sim.bolts;
  if (!src || src.length === 0) return;
  const next: SimBolt[] = [];
  const step = DRAGOON_BOLT_SPEED * TICK_DT;
  const step2 = step * step;
  const n = src.length;
  for (let i = 0; i < n; i++) {
    const b = src[i];
    if (b.impact) continue;
    if (b.born === sim.tick) {
      next.push(b);
      continue;
    }
    const target = sim.entities[b.targetId];
    if (target && boltCanHit(b, target)) {
      b.tx = target.x;
      b.tz = target.z;
    }
    const dx = b.tx - b.x;
    const dz = b.tz - b.z;
    const d2 = dx * dx + dz * dz;
    if (d2 <= step2) {
      b.x = b.tx;
      b.z = b.tz;
      b.impact = 1;
      if (target && boltCanHit(b, target)) {
        target.hp -= b.damage;
        noteHit(sim, target, b.attackerId, b.attackerTypeId, b.damage);
        if (target.hp <= 0) dead.push(target.id);
        else replaceEntity(sim, target);
      }
    } else {
      const dist = Math.sqrt(d2);
      b.x += (dx / dist) * step;
      b.z += (dz / dist) * step;
    }
    next.push(b);
  }
  sim.bolts = next;
}

function strikeTarget(
  sim: MatchSim,
  e: SimEntity,
  target: SimEntity,
  profile: { damage: number; period: number },
  dead: string[]
): void {
  e.attackCd = (e.attackCd || 0) - TICK_DT;
  if ((e.attackCd || 0) > 0) return;
  if (e.typeId === "alien_dragoon") {
    e.attackCd = profile.period;
    launchDragoonBolt(sim, e, target, profile.damage);
    return;
  }
  target.hp -= profile.damage;
  e.attackCd = profile.period;
  noteHit(sim, target, e.id, e.typeId, profile.damage);
  if (target.hp <= 0) {
    dead.push(target.id);
    delete e.orderTargetId;
  }
  // 화염방사병: 주 목표 주변 지상 적에게 절반 스플래시
  if (e.typeId !== "human_firebat") return;
  const splashDmg = Math.max(1, Math.floor(profile.damage / 2));
  const r2 = FIREBAT_SPLASH * FIREBAT_SPLASH;
  eachEntity(sim.entities, function (other) {
    if (other.id === target.id || other.id === e.id) return;
    if (other.side === e.side || other.hp <= 0) return;
    if (!isAttackableTarget(e, other)) return;
    if (isAirUnit(other.typeId)) return;
    if (dist2(target.x, target.z, other.x, other.z) > r2) return;
    other.hp -= splashDmg;
    noteHit(sim, other, e.id, e.typeId, splashDmg);
    if (other.hp <= 0) dead.push(other.id);
    else replaceEntity(sim, other);
  });
}

/** 몸통이 바닥 안에 남도록 중심을 맵 안쪽으로 당긴다. */
function mapPad(ent: SimEntity): number {
  if (ent.kind === "worker") return UNIT_COLLISION.workerR;
  if (ent.kind === "unit") return UNIT_COLLISION.unitR;
  if (ent.kind === "larva") return 0.1;
  return 0;
}

function clampMap(
  x: number,
  z: number,
  pad: number
): { x: number; z: number } {
  const minX = -WORLD.halfWidth + pad;
  const maxX = WORLD.halfWidth - pad;
  const minZ = -WORLD.halfDepth + pad;
  const maxZ = WORLD.halfDepth - pad;
  let nx = x;
  let nz = z;
  if (nx < minX) nx = minX;
  else if (nx > maxX) nx = maxX;
  if (nz < minZ) nz = minZ;
  else if (nz > maxZ) nz = maxZ;
  return { x: nx, z: nz };
}

function keepMobilesOnMap(sim: MatchSim): void {
  eachEntity(sim.entities, function (e) {
    if (e.kind !== "unit" && e.kind !== "worker" && e.kind !== "larva") return;
    const c = clampMap(e.x, e.z, mapPad(e));
    if (c.x === e.x && c.z === e.z) return;
    e.x = c.x;
    e.z = c.z;
    replaceEntity(sim, e);
  });
}

function canStand(
  sim: MatchSim,
  ent: SimEntity,
  nx: number,
  nz: number,
  ignoreBuildingId?: string
): boolean {
  const cell = worldToCell(nx, nz);
  if (
    cell.cx < 0 ||
    cell.cz < 0 ||
    cell.cx >= MAP.width ||
    cell.cz >= MAP.depth
  ) {
    return false;
  }
  // 인간 일꾼은 건설 명령(이동·시공) 중 건물·자원 충돌을 끈다.
  if (humanBuildCommand(ent)) return true;
  // 공중 유닛은 건물·HQ 위를 통과
  if (
    !isAirUnit(ent.typeId) &&
    harvestBlocked(sim, cell.cx, cell.cz, ignoreBuildingId)
  ) {
    return false;
  }
  // 채취 중이 아닌 일꾼은 미네랄·에테르와 충돌.
  // 에테르 건물로 이동 중일 때만 분출구 칸을 통과한다.
  const pendingDef = ent.morphBuild ? buildingDef(ent.morphBuild) : null;
  const ignoreGas =
    ent.kind === "worker" && pendingDef !== null && pendingDef.role === "gas";
  if (
    ent.kind === "worker" &&
    !ent.harvestPhase &&
    resourceBlocked(sim, cell.cx, cell.cz, ignoreGas)
  ) {
    return false;
  }
  return true;
}

function tryMoveEntity(
  sim: MatchSim,
  ent: SimEntity,
  nx: number,
  nz: number,
  ignoreBuildingId?: string
): boolean {
  const c = clampMap(nx, nz, mapPad(ent));
  if (!canStand(sim, ent, c.x, c.z, ignoreBuildingId)) return false;
  if (c.x !== ent.x || c.z !== ent.z) ent.movedTick = sim.tick;
  ent.x = c.x;
  ent.z = c.z;
  return true;
}

function isMobileCollider(e: SimEntity): boolean {
  return e.kind === "unit" || e.kind === "worker";
}

function unitCollisionRadius(e: SimEntity): number {
  if (e.kind === "worker") return UNIT_COLLISION.workerR;
  return UNIT_COLLISION.unitR;
}

/** 밀어내기 적용. 건물·맵에 막히면 축 분리 시도. */
function applySeparationStep(
  sim: MatchSim,
  ent: SimEntity,
  dx: number,
  dz: number
): void {
  if (dx === 0 && dz === 0) return;
  if (tryMoveEntity(sim, ent, ent.x + dx, ent.z + dz)) return;
  if (dx !== 0 && tryMoveEntity(sim, ent, ent.x + dx, ent.z)) return;
  if (dz !== 0) tryMoveEntity(sim, ent, ent.x, ent.z + dz);
}

/** 인간 일꾼이 건설 지점으로 가거나 시공 중이면 충돌을 끈다. */
function humanBuildCommand(e: SimEntity): boolean {
  return (
    e.kind === "worker" &&
    e.typeId === "human_worker" &&
    (!!e.morphBuild || !!e.busyOn)
  );
}

/** 채취·건설 중 일꾼, 건물 밖으로 밀려 나는 유닛 — 소프트 충돌에서 제외. */
function skipsSoftCollision(e: SimEntity): boolean {
  if (isFiniteNum(e.ejectX)) return true;
  return (
    e.kind === "worker" &&
    (!!e.harvestPhase || !!e.busyOn || humanBuildCommand(e))
  );
}

const SEP_CELL = 0.5;
/** 맵 밖 한 칸까지 포함한 분리 격자. 원점은 음수 칸을 양수로 민다. */
const SEP_STRIDE = 40;
const SEP_ROWS = 80;
const SEP_ORIGIN_X = 16;
const SEP_ORIGIN_Z = 40;

function sepCellIndex(ix: number, iz: number): number {
  let x = ix + SEP_ORIGIN_X;
  let z = iz + SEP_ORIGIN_Z;
  if (x < 0) x = 0;
  else if (x >= SEP_STRIDE) x = SEP_STRIDE - 1;
  if (z < 0) z = 0;
  else if (z >= SEP_ROWS) z = SEP_ROWS - 1;
  return z * SEP_STRIDE + x;
}

/**
 * 아군 이동체 소프트 충돌. 완전 블로킹 없이 겹침만 완화한다.
 * 채취·건설 중 일꾼은 유닛 간 밀어내기에서 제외한다.
 * 이번 틱에 움직인 유닛과 그 옆 칸만 비교한다.
 */
function separateAllies(sim: MatchSim): void {
  const mobiles: SimEntity[] = [];
  eachEntity(sim.entities, function (e) {
    if (e.hp > 0 && isMobileCollider(e) && !skipsSoftCollision(e)) {
      mobiles.push(e);
    }
  });
  const n = mobiles.length;
  if (n < 2) return;

  const px: number[] = [];
  const pz: number[] = [];
  for (let i = 0; i < n; i++) {
    px.push(0);
    pz.push(0);
  }

  // Goja: 객체에 넣은 배열은 push 할 수 없다. 인덱스 연결로 칸을 나눈다.
  const head: number[] = [];
  const next: number[] = [];
  const cellN = SEP_STRIDE * SEP_ROWS;
  for (let i = 0; i < cellN; i++) head.push(-1);
  for (let i = 0; i < n; i++) next.push(-1);
  for (let i = 0; i < n; i++) {
    const idx = sepCellIndex(
      Math.floor(mobiles[i].x / SEP_CELL),
      Math.floor(mobiles[i].z / SEP_CELL)
    );
    next[i] = head[idx];
    head[idx] = i;
  }

  for (let i = 0; i < n; i++) {
    const a = mobiles[i];
    const aMoved = a.movedTick === sim.tick;
    const ra = unitCollisionRadius(a);
    const ix = Math.floor(a.x / SEP_CELL);
    const iz = Math.floor(a.z / SEP_CELL);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        let j = head[sepCellIndex(ix + dx, iz + dz)];
        while (j >= 0) {
          const cur = j;
          j = next[j];
          if (cur <= i) continue;
          const b = mobiles[cur];
          if (!aMoved && b.movedTick !== sim.tick) continue;
          if (a.side !== b.side) continue;
          // 공중↔지상은 서로 밀어내지 않음 (공중↔공중·지상↔지상만)
          if (!layersCollide(a.typeId, b.typeId)) continue;
          const rb = unitCollisionRadius(b);
          const minD = ra + rb;
          let ox = b.x - a.x;
          let oz = b.z - a.z;
          let d = Math.sqrt(ox * ox + oz * oz);
          if (d >= minD) continue;
          if (d < 1e-4) {
            const h =
              (a.id.charCodeAt(0) +
                b.id.charCodeAt(b.id.length - 1) +
                i +
                cur) %
              8;
            const ang = (h / 8) * Math.PI * 2;
            ox = Math.cos(ang);
            oz = Math.sin(ang);
            d = 1;
          }
          const overlap = minD - d;
          const push = Math.min(
            overlap * 0.5 * UNIT_COLLISION.stiffness,
            UNIT_COLLISION.maxPush
          );
          const ux = ox / d;
          const uz = oz / d;
          px[i] -= ux * push;
          pz[i] -= uz * push;
          px[cur] += ux * push;
          pz[cur] += uz * push;
        }
      }
    }
  }

  for (let i = 0; i < n; i++) {
    applySeparationStep(sim, mobiles[i], px[i], pz[i]);
  }
}

/** 공중·건설 중 인간 일꾼은 건물을 통과하므로 격자 경로를 쓰지 않는다. */
function usesGridPath(ent: SimEntity): boolean {
  if (isAirUnit(ent.typeId)) return false;
  if (humanBuildCommand(ent)) return false;
  return true;
}

function lineClear(
  sim: MatchSim,
  ent: SimEntity,
  x: number,
  z: number
): boolean {
  const dx = x - ent.x;
  const dz = z - ent.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 1e-4) return true;
  const n = Math.ceil(dist / (MAP.cellSize * 0.45));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!canStand(sim, ent, ent.x + dx * t, ent.z + dz * t)) return false;
  }
  return true;
}

function stepDirect(
  sim: MatchSim,
  ent: SimEntity,
  tx: number,
  tz: number,
  speed: number
): boolean {
  const d2 = dist2(ent.x, ent.z, tx, tz);
  if (d2 < 1e-8) return true;
  const dist = Math.sqrt(d2);
  const step =
    speedOnCreep(sim, ent.typeId, ent.kind, ent.x, ent.z, speed) * TICK_DT;
  const travel = dist <= step ? dist : step;
  const ux = (tx - ent.x) / dist;
  const uz = (tz - ent.z) / dist;
  return tryMoveEntity(sim, ent, ent.x + ux * travel, ent.z + uz * travel);
}

function octile(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax > bx ? ax - bx : bx - ax;
  const dz = az > bz ? az - bz : bz - az;
  const m = dx < dz ? dx : dz;
  return 10 * (dx + dz) - 6 * m;
}

function heapPush(
  heap: { id: number; f: number }[],
  node: { id: number; f: number }
): void {
  heap.push(node);
  let i = heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p].f <= heap[i].f) break;
    const tmp = heap[p];
    heap[p] = heap[i];
    heap[i] = tmp;
    i = p;
  }
}

function heapPop(
  heap: { id: number; f: number }[]
): { id: number; f: number } | null {
  if (!heap.length) return null;
  const top = heap[0];
  const last = heap.pop();
  if (heap.length && last) {
    heap[0] = last;
    let i = 0;
    while (true) {
      const l = i * 2 + 1;
      const r = l + 1;
      let s = i;
      if (l < heap.length && heap[l].f < heap[s].f) s = l;
      if (r < heap.length && heap[r].f < heap[s].f) s = r;
      if (s === i) break;
      const tmp = heap[i];
      heap[i] = heap[s];
      heap[s] = tmp;
      i = s;
    }
  }
  return top || null;
}

/** 목표 칸이 막혀 있으면, 가장 가까운 빈 칸 중 유닛에 가까운 쪽. */
function nearestOpenCell(
  blocked: number[],
  tx: number,
  tz: number,
  ux: number,
  uz: number
): { cx: number; cz: number } | null {
  const w = MAP.width;
  const d = MAP.depth;
  const g = worldToCell(tx, tz);
  let gx = g.cx;
  let gz = g.cz;
  if (gx < 0) gx = 0;
  if (gz < 0) gz = 0;
  if (gx >= w) gx = w - 1;
  if (gz >= d) gz = d - 1;
  let bestCx = -1;
  let bestCz = -1;
  let bestD = 1e18;
  let bestU = 1e18;
  for (let r = 0; r <= 18; r++) {
    let found = false;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (r > 0 && Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const cx = gx + dx;
        const cz = gz + dz;
        if (cx < 0 || cz < 0 || cx >= w || cz >= d) continue;
        if (blocked[cz * w + cx]) continue;
        const c = cellCenter(cx, cz);
        const ddx = c.x - tx;
        const ddz = c.z - tz;
        const dd = ddx * ddx + ddz * ddz;
        const udx = c.x - ux;
        const udz = c.z - uz;
        const uu = udx * udx + udz * udz;
        if (
          !found ||
          dd < bestD - 1e-6 ||
          (Math.abs(dd - bestD) <= 1e-6 && uu < bestU)
        ) {
          found = true;
          bestD = dd;
          bestU = uu;
          bestCx = cx;
          bestCz = cz;
        }
      }
    }
    if (found) return { cx: bestCx, cz: bestCz };
  }
  return null;
}

const NAV_N = MAP.width * MAP.depth;
let occBuild: number[] = [];
let occMineral: number[] = [];
let occGas: number[] = [];
let pathBlocked: number[] = [];
let gScore: number[] = [];
let fScore: number[] = [];
let astarParent: number[] = [];
let astarSeen: number[] = [];
let astarGen = 0;
let occStamp = 0;
let occRev = 0;
let occReady = false;
let routeRev = -1;
let routes: { [key: string]: { xs: number[]; zs: number[] } } = {};
const ASTAR_DX = [1, -1, 0, 0, 1, 1, -1, -1];
const ASTAR_DZ = [0, 0, 1, -1, 1, -1, 1, -1];
const ASTAR_COST = [10, 10, 10, 10, 14, 14, 14, 14];

function ensureNavBuffers(): void {
  if (occBuild.length === NAV_N) return;
  const build: number[] = [];
  const mineral: number[] = [];
  const gas: number[] = [];
  const blocked: number[] = [];
  const gs: number[] = [];
  const fs: number[] = [];
  const parent: number[] = [];
  const seen: number[] = [];
  for (let i = 0; i < NAV_N; i++) {
    build.push(0);
    mineral.push(0);
    gas.push(0);
    blocked.push(0);
    gs.push(0);
    fs.push(0);
    parent.push(-1);
    seen.push(0);
  }
  occBuild = build;
  occMineral = mineral;
  occGas = gas;
  pathBlocked = blocked;
  gScore = gs;
  fScore = fs;
  astarParent = parent;
  astarSeen = seen;
}

function mixHash(h: number, v: number): number {
  return (h * 33 + v) | 0;
}

/** 건물·자원·예약 발자국이 바뀌었는지. 칸 좌표만 본다. */
function blockerStamp(sim: MatchSim): number {
  let h = 216613626;
  eachEntity(sim.entities, function (e) {
    let bit = 0;
    let x = e.x;
    let z = e.z;
    if ((e.kind === "building" || e.kind === "hq") && e.hp > 0) bit = 1;
    else if (e.kind === "mineral" && e.hp > 0) bit = 2;
    else if (e.kind === "gas" && e.hp > 0) bit = 3;
    else if (
      e.kind === "worker" &&
      e.morphBuild &&
      isFiniteNum(e.morphX) &&
      isFiniteNum(e.morphZ)
    ) {
      bit = 4;
      x = e.morphX;
      z = e.morphZ;
    }
    if (!bit) return;
    const c = worldToCell(x, z);
    h = mixHash(h, bit);
    h = mixHash(h, c.cx);
    h = mixHash(h, c.cz);
    h = mixHash(h, e.typeId.length);
  });
  return h;
}

function refreshOccupancy(sim: MatchSim): void {
  ensureNavBuffers();
  const stamp = blockerStamp(sim);
  if (occReady && stamp === occStamp) return;
  occStamp = stamp;
  occRev += 1;
  occReady = true;
  routeRev = -1;
  routes = {};
  for (let i = 0; i < NAV_N; i++) {
    occBuild[i] = 0;
    occMineral[i] = 0;
    occGas[i] = 0;
  }
  eachEntity(sim.entities, function (e) {
    if (e.hp <= 0) return;
    if (e.kind === "building" || e.kind === "hq") {
      stampBlocked(occBuild, MAP.width, MAP.depth, e.x, e.z, e.kind, e.typeId);
    } else if (e.kind === "mineral") {
      stampBlocked(occMineral, MAP.width, MAP.depth, e.x, e.z, e.kind, e.typeId);
    } else if (e.kind === "gas") {
      stampBlocked(occGas, MAP.width, MAP.depth, e.x, e.z, e.kind, e.typeId);
    }
  });
}

/** 전투 유닛 0, 자원 막는 일꾼 1, 에테르 분출구를 통과하는 일꾼 2. */
function pathClass(ent: SimEntity): number {
  if (ent.kind !== "worker" || ent.harvestPhase) return 0;
  const pendingDef = ent.morphBuild ? buildingDef(ent.morphBuild) : null;
  if (pendingDef !== null && pendingDef.role === "gas") return 2;
  return 1;
}

function fillPathBlocked(sim: MatchSim, ent: SimEntity): void {
  if (!occReady) refreshOccupancy(sim);
  const blockResources = ent.kind === "worker" && !ent.harvestPhase;
  const pendingDef = ent.morphBuild ? buildingDef(ent.morphBuild) : null;
  const ignoreGas =
    ent.kind === "worker" && pendingDef !== null && pendingDef.role === "gas";
  for (let i = 0; i < NAV_N; i++) {
    let b = occBuild[i];
    if (blockResources && (occMineral[i] || (!ignoreGas && occGas[i]))) b = 1;
    pathBlocked[i] = b;
  }
  eachEntity(sim.entities, function (e) {
    if (
      e.id !== ent.id &&
      e.kind === "worker" &&
      e.morphBuild &&
      isFiniteNum(e.morphX) &&
      isFiniteNum(e.morphZ)
    ) {
      stampBlocked(
        pathBlocked,
        MAP.width,
        MAP.depth,
        e.morphX,
        e.morphZ,
        "building",
        e.morphBuild
      );
    }
  });
}

function rememberRoute(
  tx: number,
  tz: number,
  xs: number[],
  zs: number[]
): void {
  if (!xs.length) return;
  if (routeRev !== occRev) {
    routeRev = occRev;
    routes = {};
  }
  const g = worldToCell(tx, tz);
  const key = g.cx + ":" + g.cz;
  if (routes[key]) return;
  const cxs: number[] = [];
  const czs: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    cxs.push(xs[i]);
    czs.push(zs[i]);
  }
  routes[key] = { xs: cxs, zs: czs };
}

/** 같은 칸 목적지면 가까운 경유점부터 합류하고, 마지막만 자기 좌표로 둔다. */
function takeSharedRoute(
  sim: MatchSim,
  ent: SimEntity,
  tx: number,
  tz: number
): { xs: number[]; zs: number[] } | null {
  if (routeRev !== occRev) return null;
  const g = worldToCell(tx, tz);
  const hit = routes[g.cx + ":" + g.cz];
  if (!hit || !hit.xs.length) return null;
  let bestI = 0;
  let bestD = dist2(ent.x, ent.z, hit.xs[0], hit.zs[0]);
  for (let i = 1; i < hit.xs.length; i++) {
    const d = dist2(ent.x, ent.z, hit.xs[i], hit.zs[i]);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  if (bestD > 6.25) return null;
  if (!lineClear(sim, ent, hit.xs[bestI], hit.zs[bestI])) return null;
  const xs: number[] = [];
  const zs: number[] = [];
  for (let i = bestI; i < hit.xs.length; i++) {
    xs.push(hit.xs[i]);
    zs.push(hit.zs[i]);
  }
  const last = xs.length - 1;
  if (last < 0 || dist2(xs[last], zs[last], tx, tz) > 0.0001) {
    if (canStand(sim, ent, tx, tz)) {
      xs.push(tx);
      zs.push(tz);
    }
  }
  return { xs: xs, zs: zs };
}

function astarMark(i: number): void {
  if (astarSeen[i] === astarGen) return;
  astarSeen[i] = astarGen;
  gScore[i] = 1e9;
  fScore[i] = 1e9;
  astarParent[i] = -1;
}

/** 건물·자원·예약 발자국이 덮는 칸을 이동 불가로 표시한다. */
function stampBlocked(
  blocked: number[],
  w: number,
  d: number,
  x: number,
  z: number,
  kind: string,
  typeId: string
): void {
  const half = blockerHalf(kind, typeId);
  const min = worldToCell(x - half.x - MAP.cellSize, z - half.z - MAP.cellSize);
  const max = worldToCell(x + half.x + MAP.cellSize, z + half.z + MAP.cellSize);
  for (let cz = min.cz; cz <= max.cz; cz++) {
    for (let cx = min.cx; cx <= max.cx; cx++) {
      if (cx < 0 || cz < 0 || cx >= w || cz >= d) continue;
      if (overlapsCell(x, z, kind, typeId, cx, cz)) blocked[cz * w + cx] = 1;
    }
  }
}

function findGridPath(
  sim: MatchSim,
  ent: SimEntity,
  tx: number,
  tz: number
): { xs: number[]; zs: number[] } | null {
  const share = pathClass(ent) === 0;
  if (share) {
    const shared = takeSharedRoute(sim, ent, tx, tz);
    if (shared) return shared;
  }
  const w = MAP.width;
  const d = MAP.depth;
  const n = w * d;
  fillPathBlocked(sim, ent);
  const start = worldToCell(ent.x, ent.z);
  const sx = start.cx;
  const sz = start.cz;
  if (sx < 0 || sz < 0 || sx >= w || sz >= d) return null;
  const goal = nearestOpenCell(pathBlocked, tx, tz, ent.x, ent.z);
  if (!goal) return null;
  const startI = sz * w + sx;
  if (pathBlocked[startI]) pathBlocked[startI] = 0;
  const xs: number[] = [];
  const zs: number[] = [];
  if (sx === goal.cx && sz === goal.cz) {
    if (canStand(sim, ent, tx, tz)) {
      xs.push(tx);
      zs.push(tz);
    }
    if (share) rememberRoute(tx, tz, xs, zs);
    return { xs: xs, zs: zs };
  }

  astarGen += 1;
  if (astarGen >= 1000000000) {
    astarGen = 1;
    for (let i = 0; i < n; i++) astarSeen[i] = 0;
  }
  astarMark(startI);
  const goalI = goal.cz * w + goal.cx;
  gScore[startI] = 0;
  fScore[startI] = octile(sx, sz, goal.cx, goal.cz);
  const heap: { id: number; f: number }[] = [];
  heapPush(heap, { id: startI, f: fScore[startI] });
  let found = false;
  let guard = 0;
  while (heap.length && guard < n) {
    guard += 1;
    const node = heapPop(heap);
    if (!node) break;
    if (astarSeen[node.id] !== astarGen || node.f > fScore[node.id]) continue;
    if (node.id === goalI) {
      found = true;
      break;
    }
    const cz = Math.floor(node.id / w);
    const cx = node.id - cz * w;
    for (let k = 0; k < 8; k++) {
      const nx = cx + ASTAR_DX[k];
      const nz = cz + ASTAR_DZ[k];
      if (nx < 0 || nz < 0 || nx >= w || nz >= d) continue;
      const ni = nz * w + nx;
      if (pathBlocked[ni]) continue;
      if (k >= 4) {
        if (pathBlocked[cz * w + nx] || pathBlocked[nz * w + cx]) continue;
      }
      const seen = astarSeen[ni] === astarGen;
      const prevG = seen ? gScore[ni] : 1e9;
      const ng = gScore[node.id] + ASTAR_COST[k];
      if (ng >= prevG) continue;
      astarMark(ni);
      astarParent[ni] = node.id;
      gScore[ni] = ng;
      fScore[ni] = ng + octile(nx, nz, goal.cx, goal.cz);
      heapPush(heap, { id: ni, f: fScore[ni] });
    }
  }
  if (!found) return null;

  const revX: number[] = [];
  const revZ: number[] = [];
  let cur = goalI;
  let safe = 0;
  while (cur !== startI && cur >= 0 && safe < n) {
    if (astarSeen[cur] !== astarGen) break;
    const cz = Math.floor(cur / w);
    const cx = cur - cz * w;
    const c = cellCenter(cx, cz);
    revX.push(c.x);
    revZ.push(c.z);
    cur = astarParent[cur];
    safe += 1;
  }
  for (let i = revX.length - 1; i >= 0; i--) {
    xs.push(revX[i]);
    zs.push(revZ[i]);
  }
  if (canStand(sim, ent, tx, tz)) {
    xs.push(tx);
    zs.push(tz);
  }
  if (share) rememberRoute(tx, tz, xs, zs);
  return { xs: xs, zs: zs };
}

function dropGridPath(ent: SimEntity): void {
  delete ent.navXs;
  delete ent.navZs;
  delete ent.navI;
  delete ent.navGX;
  delete ent.navGZ;
  delete ent.navBest;
  delete ent.navFar;
  delete ent.navFarRev;
}

/** 다음 경유점이 건물·이동 불가 칸에 들어갔는지. */
function pathAheadBlocked(sim: MatchSim, ent: SimEntity): boolean {
  const xs = ent.navXs;
  const zs = ent.navZs;
  if (!xs || !zs || xs.length === 0) return false;
  let i = ent.navI || 0;
  if (i < 0) i = 0;
  if (i >= xs.length) i = xs.length - 1;
  return !canStand(sim, ent, xs[i], zs[i]);
}

function ensureGridPath(
  sim: MatchSim,
  ent: SimEntity,
  tx: number,
  tz: number
): void {
  const gx = ent.navGX;
  const gz = ent.navGZ;
  const have = !!ent.navXs && isFiniteNum(gx) && isFiniteNum(gz);
  const sameGoal = have && dist2(gx, gz, tx, tz) <= 0.16;
  const stalled = (ent.navStuck || 0) >= 5;
  if (
    sameGoal &&
    !stalled &&
    !pathAheadBlocked(sim, ent) &&
    ent.navXs &&
    (ent.navXs.length > 0 || (ent.navStuck || 0) < 5)
  ) {
    return;
  }
  const path = findGridPath(sim, ent, tx, tz);
  ent.navGX = tx;
  ent.navGZ = tz;
  ent.navI = 0;
  ent.navStuck = 0;
  delete ent.navBest;
  delete ent.navFar;
  delete ent.navFarRev;
  if (!path) {
    ent.navXs = [];
    ent.navZs = [];
    return;
  }
  ent.navXs = path.xs;
  ent.navZs = path.zs;
}

/** 캐시된 경로의 보이는 경유점으로 한 걸음. 경유점이 막히면 false. */
function gridSteer(
  sim: MatchSim,
  ent: SimEntity,
  tx: number,
  tz: number,
  speed: number
): boolean {
  const xs = ent.navXs;
  const zs = ent.navZs;
  if (!xs || !zs || xs.length === 0) return false;
  let i = ent.navI || 0;
  if (i < 0) i = 0;
  while (i < xs.length && dist2(ent.x, ent.z, xs[i], zs[i]) <= 0.0144) {
    i += 1;
  }
  let wx = tx;
  let wz = tz;
  if (i < xs.length) {
    let far = i;
    const cachedFar =
      ent.navFarRev === occRev &&
      typeof ent.navFar === "number" &&
      ent.navFar >= i &&
      ent.navFar < xs.length;
    if (cachedFar) {
      far = ent.navFar as number;
    } else {
      for (let k = xs.length - 1; k >= i; k--) {
        if (lineClear(sim, ent, xs[k], zs[k])) {
          far = k;
          break;
        }
      }
      ent.navFar = far;
      ent.navFarRev = occRev;
    }
    if (!canStand(sim, ent, xs[far], zs[far])) return false;
    wx = xs[far];
    wz = zs[far];
    i = far;
  }
  ent.navI = i;
  if (!stepDirect(sim, ent, wx, wz, speed)) return false;
  const left = Math.sqrt(dist2(ent.x, ent.z, wx, wz));
  if (!isFiniteNum(ent.navBest) || left < ent.navBest - 0.03) {
    ent.navBest = left;
    ent.navStuck = 0;
  } else {
    ent.navStuck = (ent.navStuck || 0) + 1;
  }
  delete ent.slideSign;
  delete ent.slideHold;
  return true;
}

/** 직선이 막히면 격자 최단 경로로 걷고, 중간이 막히면 그 자리에서 다시 찾는다. */
function followGridPath(
  sim: MatchSim,
  ent: SimEntity,
  tx: number,
  tz: number,
  speed: number
): boolean | null {
  const lineFresh =
    ent.navLineOk === 1 &&
    ent.navLineRev === occRev &&
    isFiniteNum(ent.navGX) &&
    isFiniteNum(ent.navGZ) &&
    dist2(ent.navGX, ent.navGZ, tx, tz) <= 0.16;
  if (lineFresh) {
    if (stepDirect(sim, ent, tx, tz, speed)) return true;
    delete ent.navLineOk;
  }
  const lineBlocked =
    ent.navLineOk === 0 &&
    ent.navLineRev === occRev &&
    isFiniteNum(ent.navGX) &&
    isFiniteNum(ent.navGZ) &&
    dist2(ent.navGX, ent.navGZ, tx, tz) <= 0.16;
  if (!lineBlocked) {
    if (lineClear(sim, ent, tx, tz) && stepDirect(sim, ent, tx, tz, speed)) {
      dropGridPath(ent);
      delete ent.slideSign;
      delete ent.slideHold;
      ent.navLineOk = 1;
      ent.navLineRev = occRev;
      ent.navGX = tx;
      ent.navGZ = tz;
      return true;
    }
    ent.navLineOk = 0;
    ent.navLineRev = occRev;
  }
  ensureGridPath(sim, ent, tx, tz);
  if (gridSteer(sim, ent, tx, tz, speed)) return true;
  // 진행 중이던 길이 건물이나 이동 불가 칸에 막히면 한 번 더 찾는다.
  if ((ent.navStuck || 0) === 0 && ent.navXs && ent.navXs.length > 0) {
    ent.navStuck = 5;
    ensureGridPath(sim, ent, tx, tz);
    if (gridSteer(sim, ent, tx, tz, speed)) return true;
  }
  ent.navStuck = 1;
  return null;
}

/** 직선이 막힐 때 시도할 편향각(라디안). 약 35°, 70°, 110°. */
const SLIDE_ANGLES = [0.61, 1.22, 1.92];
const SLIDE_HOLD_TICKS = 6;
const STUCK_FLIP_TICKS = 8;

function noteNavProgress(ent: SimEntity, dist: number): void {
  const prev = ent.navBest;
  if (!isFiniteNum(prev) || dist < prev - 0.05) {
    ent.navBest = dist;
    ent.navStuck = 0;
    return;
  }
  ent.navStuck = (ent.navStuck || 0) + 1;
  if ((ent.navStuck || 0) < STUCK_FLIP_TICKS) return;
  const cur = ent.slideSign === -1 ? -1 : 1;
  ent.slideSign = -cur;
  ent.slideHold = SLIDE_HOLD_TICKS;
  ent.navStuck = 0;
  ent.navBest = dist;
}

/**
 * 직선 → 축 분리 → 좌우 벽 따라가기.
 * 고른 방향은 몇 틱 유지하고, 거리가 줄지 않으면 반대편으로 뒤집는다.
 */
function moveEntityToward(
  sim: MatchSim,
  ent: SimEntity,
  tx: number,
  tz: number,
  speed: number,
  stopDist: number
): boolean {
  const d2 = dist2(ent.x, ent.z, tx, tz);
  const stop2 = stopDist * stopDist;
  if (d2 <= stop2) {
    clearNav(ent);
    return true;
  }
  if (usesGridPath(ent)) {
    const along = followGridPath(sim, ent, tx, tz, speed);
    if (along) return dist2(ent.x, ent.z, tx, tz) <= stop2;
  }
  const dist = Math.sqrt(d2);
  const step =
    speedOnCreep(sim, ent.typeId, ent.kind, ent.x, ent.z, speed) * TICK_DT;
  const travel = dist <= step ? dist : step;
  const ux = (tx - ent.x) / dist;
  const uz = (tz - ent.z) / dist;
  if (tryMoveEntity(sim, ent, ent.x + ux * travel, ent.z + uz * travel)) {
    clearNav(ent);
    return dist2(ent.x, ent.z, tx, tz) <= stop2;
  }

  const hold = typeof ent.slideHold === "number" ? ent.slideHold : 0;
  const preferred =
    ent.slideSign === 1 || ent.slideSign === -1 ? ent.slideSign : 1;
  const heading = Math.atan2(uz, ux);
  let bestX = ent.x;
  let bestZ = ent.z;
  let bestScore = -1e9;
  let bestSign = 0;
  let found = false;

  function consider(nx: number, nz: number, sign: number): void {
    if (!canStand(sim, ent, nx, nz)) return;
    const nd = Math.sqrt(dist2(nx, nz, tx, tz));
    let score = dist - nd;
    if (sign !== 0 && sign === preferred && hold > 0) score += 0.02;
    if (!found || score > bestScore) {
      found = true;
      bestScore = score;
      bestX = nx;
      bestZ = nz;
      bestSign = sign;
    }
  }

  consider(ent.x + ux * travel, ent.z, 0);
  consider(ent.x, ent.z + uz * travel, 0);

  const signs = hold > 0 ? [preferred] : [preferred, -preferred];
  for (let si = 0; si < signs.length; si++) {
    const sign = signs[si];
    for (let ai = 0; ai < SLIDE_ANGLES.length; ai++) {
      const ang = heading + sign * SLIDE_ANGLES[ai];
      consider(
        ent.x + Math.cos(ang) * travel,
        ent.z + Math.sin(ang) * travel,
        sign
      );
    }
  }
  if (!found && hold > 0) {
    const sign = -preferred;
    for (let ai = 0; ai < SLIDE_ANGLES.length; ai++) {
      const ang = heading + sign * SLIDE_ANGLES[ai];
      consider(
        ent.x + Math.cos(ang) * travel,
        ent.z + Math.sin(ang) * travel,
        sign
      );
    }
  }

  if (!found) {
    noteNavProgress(ent, dist);
    return false;
  }
  tryMoveEntity(sim, ent, bestX, bestZ);
  if (bestSign !== 0) {
    ent.slideSign = bestSign;
    ent.slideHold = hold > 0 ? hold - 1 : SLIDE_HOLD_TICKS;
  } else if (bestScore > 0) {
    delete ent.slideHold;
  }
  noteNavProgress(ent, Math.sqrt(dist2(ent.x, ent.z, tx, tz)));
  return dist2(ent.x, ent.z, tx, tz) <= stop2;
}

/** 건물·HQ는 중심이 아니라 발 디딜 가장자리까지의 거리. */
function distToFootprint(x: number, z: number, target: SimEntity): number {
  const half = entityHalfExtents(target);
  const dx = Math.abs(x - target.x) - half.x;
  const dz = Math.abs(z - target.z) - half.z;
  const ox = dx > 0 ? dx : 0;
  const oz = dz > 0 ? dz : 0;
  if (dx <= 0 && dz <= 0) return 0;
  return Math.sqrt(ox * ox + oz * oz);
}

/** 칼날충·돌격전사·일꾼. 화염병은 짧은 방사 사거리를 유지한다. */
function meleeAttacker(typeId: string): boolean {
  return (
    typeId.indexOf("blade") >= 0 ||
    typeId.indexOf("guardian") >= 0 ||
    typeId.indexOf("worker") >= 0
  );
}

/**
 * 보이는 몸통 반경. 평면 크기의 절반에 불투명 영역 비율을 곱한다.
 * 평면 크기는 client entityFoot.groundFoot 과 같다.
 */
function spriteRadius(e: SimEntity): number {
  let plane = 0.62;
  if (e.kind === "worker" || e.typeId.indexOf("worker") >= 0) plane = 0.55;
  else if (e.typeId === "monster_blade") plane = 0.38;
  else if (e.typeId === "monster_hydra") plane = 0.55;
  else if (e.typeId === "alien_dragoon") plane = 0.72;
  else if (e.kind === "larva") plane = 0.26;
  else if (e.kind === "egg") plane = 0.36;
  return plane * 0.36;
}

/** 몸통이 거의 맞닿는 여유. 이보다 벌어지면 근접 공격이 나가지 않는다. */
const MELEE_GAP = 0.04;

/** 원거리 유닛은 목록 사거리. 근접은 양쪽 몸통이 닿는 거리. */
function weaponRange(attacker: SimEntity, target: SimEntity, listed: number): number {
  if (!meleeAttacker(attacker.typeId)) return listed;
  const self = spriteRadius(attacker);
  if (target.kind === "building" || target.kind === "hq") return self + MELEE_GAP;
  return self + spriteRadius(target) + MELEE_GAP;
}

function targetInWeaponRange(
  ent: SimEntity,
  target: SimEntity,
  range: number
): boolean {
  const reach = weaponRange(ent, target, range);
  if (target.kind === "building" || target.kind === "hq") {
    return distToFootprint(ent.x, ent.z, target) <= reach;
  }
  return dist2(ent.x, ent.z, target.x, target.z) <= reach * reach;
}

/** 도착 판정 오차. 이 안에 서면 무기 사거리 안이어야 한다. */
const APPROACH_STOP = 0.05;

function attackSlotTaken(
  xs: number[],
  zs: number[],
  x: number,
  z: number
): boolean {
  for (let i = 0; i < xs.length; i++) {
    if (dist2(xs[i], zs[i], x, z) < GATHER_GAP2) return true;
  }
  return false;
}

/** 같은 대상을 노리는 아군이 이미 잡은 자리. */
function collectAttackSlots(
  sim: MatchSim,
  ent: SimEntity,
  target: SimEntity,
  xs: number[],
  zs: number[]
): void {
  eachEntity(sim.entities, function (e) {
    if (e.id === ent.id || e.hp <= 0 || e.side !== ent.side) return;
    if (e.orderTargetId !== target.id) return;
    if (e.order !== "attack" && e.order !== "attack_move") return;
    if (isFiniteNum(e.approachX) && isFiniteNum(e.approachZ)) {
      if (dist2(e.approachX, e.approachZ, target.x, target.z) < 9) {
        xs.push(e.approachX);
        zs.push(e.approachZ);
      }
      return;
    }
    if (dist2(e.x, e.z, target.x, target.z) < 2.25) {
      xs.push(e.x);
      zs.push(e.z);
    }
  });
}

function holdApproach(e: SimEntity): void {
  e.approachX = e.x;
  e.approachZ = e.z;
}

/**
 * 공격이 나가는 지점. 목표 중심이 아니라, 설 수 있고 사거리 안인 자리.
 * 건물·HQ는 발자국 가장자리에서, 유닛은 중심에서 잰다.
 * 같은 대상을 치는 아군이 있으면 그 다음으로 가까운 빈 자리를 고른다.
 */
function attackApproach(
  sim: MatchSim,
  ent: SimEntity,
  target: SimEntity,
  range: number
): { x: number; z: number; stop: number } {
  const reach = weaponRange(ent, target, range);
  const inset = APPROACH_STOP + 0.02;
  let gap = reach - inset;
  if (gap < 0.02) gap = 0.02;

  let dx = ent.x - target.x;
  let dz = ent.z - target.z;
  let len = Math.sqrt(dx * dx + dz * dz);
  if (len < 1e-4) {
    dx = 0;
    dz = 1;
    len = 1;
  }
  const ux = dx / len;
  const uz = dz / len;

  let ox = target.x;
  let oz = target.z;
  const structure = target.kind === "building" || target.kind === "hq";
  if (structure) {
    const half = entityHalfExtents(target);
    const adx = Math.abs(dx);
    const adz = Math.abs(dz);
    const tx = adx < 1e-6 ? 1e9 : half.x / adx;
    const tz = adz < 1e-6 ? 1e9 : half.z / adz;
    const t = tx < tz ? tx : tz;
    ox = target.x + dx * t;
    oz = target.z + dz * t;
  }

  const slotX: number[] = [];
  const slotZ: number[] = [];
  collectAttackSlots(sim, ent, target, slotX, slotZ);

  const angles = [0, 0.55, -0.55, 1.15, -1.15, 1.8, -1.8, 2.5, -2.5, 3.1416];
  let bestX = ox + ux * gap;
  let bestZ = oz + uz * gap;
  let bestScore = 1e9;
  let found = false;
  for (let ai = 0; ai < angles.length; ai++) {
    const ang = angles[ai];
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const rx = ux * c - uz * s;
    const rz = ux * s + uz * c;
    for (let step = 0; step <= 8; step++) {
      const dist = gap - step * (MAP.cellSize * 0.35);
      if (dist < 0.02) break;
      const x = ox + rx * dist;
      const z = oz + rz * dist;
      if (!canStand(sim, ent, x, z)) continue;
      const inside = structure
        ? distToFootprint(x, z, target) <= reach - 0.01
        : dist2(x, z, target.x, target.z) <= (reach - 0.01) * (reach - 0.01);
      if (!inside) continue;
      const taken = attackSlotTaken(slotX, slotZ, x, z) ? 1000 : 0;
      const score = taken + dist2(ent.x, ent.z, x, z) + ai * 0.25;
      if (score < bestScore) {
        found = true;
        bestScore = score;
        bestX = x;
        bestZ = z;
      }
      break;
    }
  }
  if (!found) {
    bestX = ox + ux * gap;
    bestZ = oz + uz * gap;
  }
  ent.approachX = bestX;
  ent.approachZ = bestZ;
  return { x: bestX, z: bestZ, stop: APPROACH_STOP };
}

function tickIdleAttack(sim: MatchSim): void {
  eachEntity(sim.entities, function (e) {
    if (!canCommandUnit(e) || e.order) return;
    if (e.harvestPhase || e.morphBuild || e.busyOn) return;
    if (isConstructBusy(sim, e)) return;
    const profile = combatProfile(e.typeId);
    if (profile.damage <= 0) return;
    const target = findIdleTarget(sim, e, profile.range);
    if (!target) return;
    e.order = "attack";
    e.orderTargetId = target.id;
    delete e.orderX;
    delete e.orderZ;
    e.attackCd = 0;
    replaceEntity(sim, e);
  });
}

function tickUnitOrders(sim: MatchSim): void {
  tickIdleAttack(sim);
  const dead: string[] = [];
  eachEntity(sim.entities, function (e) {
    if (!canCommandUnit(e) || !e.order) return;
    if (isFiniteNum(e.ejectX) && isFiniteNum(e.ejectZ)) return;
    const profile = combatProfile(e.typeId);
    if (e.order === "move") {
      if (!isFiniteNum(e.orderX) || !isFiniteNum(e.orderZ)) {
        clearOrder(e);
        replaceEntity(sim, e);
        return;
      }
      const ox = e.orderX;
      const oz = e.orderZ;
      const stop = e.morphBuild ? 0.28 : 0.08;
      const arrived = moveEntityToward(sim, e, ox, oz, profile.speed, stop);
      if (arrived && e.morphBuild) {
        finishPendingBuild(sim, e);
        return;
      }
      if (arrived) clearOrder(e);
      replaceEntity(sim, e);
      return;
    }

    if (e.order === "attack") {
      if (!e.orderTargetId) {
        clearOrder(e);
        replaceEntity(sim, e);
        return;
      }
      const target = sim.entities[e.orderTargetId];
      if (!target || !isCommandAttackTarget(e, target)) {
        clearOrder(e);
        replaceEntity(sim, e);
        return;
      }
      let inRange = targetInWeaponRange(e, target, profile.range);
      if (!inRange) {
        const goal = attackApproach(sim, e, target, profile.range);
        moveEntityToward(sim, e, goal.x, goal.z, profile.speed, goal.stop);
        inRange = targetInWeaponRange(e, target, profile.range);
      }
      if (!inRange) {
        replaceEntity(sim, e);
        return;
      }
      holdApproach(e);
      clearNav(e);
      strikeTarget(sim, e, target, profile, dead);
      if (!sim.entities[target.id] || target.hp <= 0) {
        clearOrder(e);
        replaceEntity(sim, e);
      } else {
        replaceEntity(sim, e);
      }
      return;
    }

    if (e.order === "attack_move") {
      if (!isFiniteNum(e.orderX) || !isFiniteNum(e.orderZ)) {
        clearOrder(e);
        replaceEntity(sim, e);
        return;
      }
      const ox = e.orderX;
      const oz = e.orderZ;
      // 지정 타겟이 살아 있으면 우선 교전, 없으면 사거리 내 적 탐색.
      let target: SimEntity | null = null;
      if (e.orderTargetId) {
        const locked = sim.entities[e.orderTargetId];
        if (locked && isAttackableTarget(e, locked) && locked.side !== e.side) {
          target = locked;
        } else {
          delete e.orderTargetId;
        }
      }
      if (!target) {
        target = findEngageTarget(sim, e, profile.range);
        if (target) e.orderTargetId = target.id;
      }
      // 잠근 타겟이 사거리 밖이면 공격 자리까지 붙는다.
      if (target && !targetInWeaponRange(e, target, profile.range)) {
        const goal = attackApproach(sim, e, target, profile.range);
        moveEntityToward(sim, e, goal.x, goal.z, profile.speed, goal.stop);
        if (targetInWeaponRange(e, target, profile.range)) {
          clearNav(e);
          strikeTarget(sim, e, target, profile, dead);
        }
        replaceEntity(sim, e);
        return;
      }
      const inRange = !!(target && targetInWeaponRange(e, target, profile.range));
      if (inRange && target) {
        holdApproach(e);
        strikeTarget(sim, e, target, profile, dead);
        // 원거리는 사거리에 들어오면 멈춰 쏜다. 근접은 맞닿은 채로 목적지로 간다.
        if (!meleeAttacker(e.typeId)) {
          clearNav(e);
          replaceEntity(sim, e);
          return;
        }
      }
      const arrived = moveEntityToward(sim, e, ox, oz, profile.speed, 0.08);
      if (arrived && !inRange) clearOrder(e);
      replaceEntity(sim, e);
      return;
    }

    clearOrder(e);
    replaceEntity(sim, e);
  });
  tickDragoonBolts(sim, dead);
  let structureLost = false;
  for (let i = 0; i < dead.length; i++) {
    const id = dead[i];
    const killed = sim.entities[id];
    if (!killed) continue;
    if (isStructure(killed)) structureLost = true;
    delete sim.entities[id];
  }
  // 스타1 밀리: 건물이 하나도 없으면 패배 (유닛만으로는 유지 불가)
  if (structureLost) {
    refreshOccupancy(sim);
    checkElimination(sim);
  }
  applyRetaliations(sim);
}

function findHq(sim: MatchSim, side: Side): SimEntity | null {
  let hq: SimEntity | null = null;
  eachEntity(sim.entities, function (e) {
    if (hq) return;
    if (e.kind === "hq" && e.side === side && !e.constructing) hq = e;
  });
  return hq;
}

function orderHarvest(
  sim: MatchSim,
  player: SimPlayer,
  workerId: string,
  mineralId: string
): void {
  const worker = sim.entities[workerId];
  const target = sim.entities[mineralId];
  if (!worker || worker.kind !== "worker" || worker.side !== player.side) return;
  if (!target || target.hp <= 0 || target.side !== player.side) return;
  let source: "mineral" | "gas" | null = null;
  if (target.kind === "mineral") source = "mineral";
  else if (
    isGasBuilding(target) &&
    !target.constructing &&
    ventUnder(sim, target)
  ) {
    source = "gas";
  }
  if (!source) return;
  const hq = findHq(sim, player.side);
  if (!hq) return;
  const wasInside = workerInsideGas(worker);
  abandonBuild(worker);
  clearOrder(worker);
  worker.harvestPhase = "to_mineral";
  worker.harvestMineralId = target.id;
  worker.harvestHqId = hq.id;
  worker.harvestSource = source;
  worker.carry = worker.carry || 0;
  delete worker.mineLeft;
  if (wasInside) standOutside(sim, worker);
  replaceEntity(sim, worker);
}

function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

function harvestBlocked(
  sim: MatchSim,
  cx: number,
  cz: number,
  ignoreBuildingId?: string
): boolean {
  if (!ignoreBuildingId && occReady) {
    if (cx < 0 || cz < 0 || cx >= MAP.width || cz >= MAP.depth) return true;
    return occBuild[cz * MAP.width + cx] !== 0;
  }
  let blocked = false;
  eachEntity(sim.entities, function (e) {
    if (blocked) return;
    if (e.kind !== "building" && e.kind !== "hq") return;
    if (ignoreBuildingId && e.id === ignoreBuildingId) return;
    if (overlapsCell(e.x, e.z, e.kind, e.typeId, cx, cz)) blocked = true;
  });
  return blocked;
}

/** 미네랄·에테르 칸. 채취 중 일꾼은 통과한다. ignoreGas면 분출구는 통과. */
function resourceBlocked(
  sim: MatchSim,
  cx: number,
  cz: number,
  ignoreGas = false
): boolean {
  if (occReady) {
    if (cx < 0 || cz < 0 || cx >= MAP.width || cz >= MAP.depth) return true;
    const i = cz * MAP.width + cx;
    if (occMineral[i]) return true;
    if (!ignoreGas && occGas[i]) return true;
    return false;
  }
  let blocked = false;
  eachEntity(sim.entities, function (e) {
    if (blocked) return;
    if (e.kind !== "mineral" && e.kind !== "gas") return;
    if (ignoreGas && e.kind === "gas") return;
    if (e.hp <= 0) return;
    if (overlapsCell(e.x, e.z, e.kind, e.typeId, cx, cz)) blocked = true;
  });
  return blocked;
}

function buildingCorners(building: SimEntity): { x: number; z: number }[] {
  const fp = footprintOf(building.typeId);
  const halfX = (fp.w * MAP.cellSize) / 2;
  const halfZ = (fp.d * MAP.cellSize) / 2;
  const m = MAP.cellSize * 0.35;
  return [
    { x: building.x - halfX - m, z: building.z - halfZ - m },
    { x: building.x + halfX + m, z: building.z - halfZ - m },
    { x: building.x + halfX + m, z: building.z + halfZ + m },
    { x: building.x - halfX - m, z: building.z + halfZ + m },
  ];
}

/**
 * 지금 발이 막혀 있으면, 건물·자원에 걸리지 않는 가장 가까운 칸.
 * 이미 설 수 있으면 null.
 */
function nearestOpenStand(
  sim: MatchSim,
  worker: SimEntity
): { x: number; z: number } | null {
  if (canStand(sim, worker, worker.x, worker.z)) return null;
  const origin = worldToCell(worker.x, worker.z);
  const w = MAP.width;
  const d = MAP.depth;
  let bestX = 0;
  let bestZ = 0;
  let bestD = 1e18;
  for (let r = 0; r <= 16; r++) {
    let found = false;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (r > 0 && Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const cx = origin.cx + dx;
        const cz = origin.cz + dz;
        if (cx < 0 || cz < 0 || cx >= w || cz >= d) continue;
        const c = cellCenter(cx, cz);
        if (!canStand(sim, worker, c.x, c.z)) continue;
        const dd = dist2(worker.x, worker.z, c.x, c.z);
        if (!found || dd < bestD) {
          found = true;
          bestD = dd;
          bestX = c.x;
          bestZ = c.z;
        }
      }
    }
    if (found) return { x: bestX, z: bestZ };
  }
  return null;
}

/** 건설이 끝난 일꾼을 가장 가까운 빈 칸으로 빠져나오게 한다. */
function ejectBuilderOutside(sim: MatchSim, worker: SimEntity, _building: SimEntity): void {
  delete worker.busyOn;
  delete worker.buildCorner;
  delete worker.buildWait;
  clearOrder(worker);
  const spot = nearestOpenStand(sim, worker);
  if (spot) {
    worker.ejectX = spot.x;
    worker.ejectZ = spot.z;
  } else {
    delete worker.ejectX;
    delete worker.ejectZ;
  }
  replaceEntity(sim, worker);
}

/**
 * 지상 유닛·일꾼이 건물 칸에 서 있으면 가장 가까운 빈 칸으로 밀어낸다.
 * 인간 건설 일꾼과 에테르를 캐는 일꾼은 건물 안에 있는 것이 정상이다.
 */
function pushOverlappingStructures(sim: MatchSim): void {
  eachEntity(sim.entities, function (e) {
    if (e.hp <= 0) return;
    if (e.kind !== "unit" && e.kind !== "worker") return;
    if (isAirUnit(e.typeId)) return;
    if (humanBuildCommand(e)) return;
    if (workerInsideGas(e)) return;
    if (isFiniteNum(e.ejectX) && isFiniteNum(e.ejectZ)) return;
    if (canStand(sim, e, e.x, e.z)) return;
    const spot = nearestOpenStand(sim, e);
    if (!spot) return;
    e.ejectX = spot.x;
    e.ejectZ = spot.z;
    replaceEntity(sim, e);
  });
}

/** 끼인 유닛은 건물 충돌을 끄고 목표 칸까지 밀려 나온다. */
function tickEject(sim: MatchSim): void {
  eachEntity(sim.entities, function (w) {
    if (w.kind !== "worker" && w.kind !== "unit") return;
    if (!isFiniteNum(w.ejectX) || !isFiniteNum(w.ejectZ)) return;
    const tx = w.ejectX;
    const tz = w.ejectZ;
    const d2 = dist2(w.x, w.z, tx, tz);
    const dist = Math.sqrt(d2);
    const step = combatProfile(w.typeId).speed * TICK_DT;
    if (dist <= step) {
      w.x = tx;
      w.z = tz;
      delete w.ejectX;
      delete w.ejectZ;
      replaceEntity(sim, w);
      return;
    }
    w.x += ((tx - w.x) / dist) * step;
    w.z += ((tz - w.z) / dist) * step;
    replaceEntity(sim, w);
  });
}

/** 건설 중 같은 모서리가 다시 걸리면 서 있는 시간(초). */
const BUILD_CORNER_WAIT = 0.6;

/**
 * 인간 건설 일꾼: 건물 네 꼭지점 중 하나를 무작위로 고른다.
 * 지금 모서리와 같으면 잠시 기다린 뒤 다시 고른다.
 * 건설 중인 자신 사이트는 하드 충돌에서 제외.
 */
function tickBuilders(sim: MatchSim): void {
  eachEntity(sim.entities, function (w) {
    if (w.kind !== "worker" || !w.busyOn) return;
    const site = sim.entities[w.busyOn];
    if (!site) {
      delete w.busyOn;
      delete w.buildCorner;
      delete w.buildWait;
      return;
    }
    if (!site.constructing) return;

    if (typeof w.buildWait === "number") {
      w.buildWait -= TICK_DT;
      if (w.buildWait > 0) {
        replaceEntity(sim, w);
        return;
      }
      delete w.buildWait;
    }

    const corners = buildingCorners(site);
    let idx =
      typeof w.buildCorner === "number" ? w.buildCorner % corners.length : 0;
    const target = corners[idx];
    const stop = MAP.cellSize * 0.45;
    const d2v = dist2(w.x, w.z, target.x, target.z);
    if (d2v <= stop * stop) {
      const next = Math.floor(Math.random() * corners.length);
      if (next === idx) {
        w.buildWait = BUILD_CORNER_WAIT;
        replaceEntity(sim, w);
        return;
      }
      w.buildCorner = next;
      replaceEntity(sim, w);
      return;
    }
    const dist = Math.sqrt(d2v);
    const step = speedOnCreep(sim, w.typeId, w.kind, w.x, w.z, WORKER_SPEED) * TICK_DT;
    const ux = (target.x - w.x) / dist;
    const uz = (target.z - w.z) / dist;
    const nx = w.x + ux * Math.min(step, dist);
    const nz = w.z + uz * Math.min(step, dist);
    if (!tryMoveEntity(sim, w, nx, nz, site.id)) {
      if (!tryMoveEntity(sim, w, nx, w.z, site.id)) {
        tryMoveEntity(sim, w, w.x, nz, site.id);
      }
    }
    replaceEntity(sim, w);
  });
}

/** 채취 이동. 직선이 건물·사령부에 막히면 격자 경로로 우회한다. */
function moveWorkerToward(
  sim: MatchSim,
  worker: SimEntity,
  tx: number,
  tz: number,
  stopDist: number
): boolean {
  return moveEntityToward(sim, worker, tx, tz, WORKER_SPEED, stopDist);
}

function gasReach(building: SimEntity): number {
  const fp = footprintOf(building.typeId);
  const half = (Math.max(fp.w, fp.d) * MAP.cellSize) / 2;
  return half + 0.6;
}

function gasBuildingReady(building: SimEntity | null, worker: SimEntity): building is SimEntity {
  return !!(
    building &&
    isGasBuilding(building) &&
    building.side === worker.side &&
    !building.constructing &&
    building.hp > 0
  );
}

/** 에테르: 건물 밖까지 이동 → 입장 → 채취 → 퇴장 → 사령부. 동시 인원 제한 없음. */
function tickGasHarvest(sim: MatchSim, e: SimEntity, hq: SimEntity | null): void {
  const building = e.harvestMineralId ? sim.entities[e.harvestMineralId] : null;
  const ready = gasBuildingReady(building, e);

  if (e.harvestPhase === "to_mineral") {
    if (!ready || !building) {
      if ((e.carry || 0) > 0 && hq && hq.kind === "hq") {
        e.harvestPhase = "to_hq";
        return;
      }
      clearHarvest(sim, e);
      return;
    }
    const arrived = moveWorkerToward(sim, e, building.x, building.z, gasReach(building));
    if (!arrived) {
      replaceEntity(sim, e);
      return;
    }
    e.x = building.x;
    e.z = building.z;
    e.harvestPhase = "mining";
    e.mineLeft = MINERAL.harvestSec;
    replaceEntity(sim, e);
    return;
  }

  if (e.harvestPhase === "mining") {
    const vent = ready && building ? ventUnder(sim, building) : null;
    if (!vent || !building) {
      delete e.mineLeft;
      if ((e.carry || 0) > 0 && hq && hq.kind === "hq") {
        e.harvestPhase = "to_hq";
        if (building) standOutside(sim, e);
        replaceEntity(sim, e);
        return;
      }
      clearHarvest(sim, e);
      return;
    }
    if ((e.carry || 0) > 0 && e.carryKind !== "gas") {
      delete e.mineLeft;
      e.harvestPhase = "to_hq";
      standOutside(sim, e);
      replaceEntity(sim, e);
      return;
    }
    e.x = building.x;
    e.z = building.z;
    e.mineLeft = (e.mineLeft || 0) - TICK_DT;
    if ((e.mineLeft || 0) > 0) {
      replaceEntity(sim, e);
      return;
    }
    const take = Math.min(MINERAL.carry, vent.hp);
    if (take <= 0) {
      clearHarvest(sim, e);
      return;
    }
    vent.hp -= take;
    replaceEntity(sim, vent);
    e.carry = take;
    e.carryKind = "gas";
    delete e.mineLeft;
    e.harvestPhase = "to_hq";
    standOutside(sim, e);
    replaceEntity(sim, e);
    return;
  }

  if (e.harvestPhase === "to_hq") {
    if (!hq || hq.kind !== "hq") {
      clearHarvest(sim, e);
      return;
    }
    const arrived = moveWorkerToward(sim, e, hq.x, hq.z, WORKER_STOP.hq);
    if (!arrived) {
      replaceEntity(sim, e);
      return;
    }
    const owner = findPlayerBySide(sim, e.side);
    if (owner) depositCarry(owner, e.carry || 0, e.carryKind === "gas");
    e.carry = 0;
    delete e.carryKind;
    if (ready && building && ventUnder(sim, building)) {
      e.harvestPhase = "to_mineral";
      replaceEntity(sim, e);
    } else {
      clearHarvest(sim, e);
    }
  }
}

function tickHarvest(sim: MatchSim): void {
  eachEntity(sim.entities, function (e) {
    if (e.kind !== "worker" || !e.harvestPhase) return;
    if (e.busyOn) {
      clearHarvest(sim, e);
      return;
    }
    const mineral = e.harvestMineralId
      ? sim.entities[e.harvestMineralId]
      : null;
    const hq = e.harvestHqId ? sim.entities[e.harvestHqId] : null;
    if (e.harvestSource === "gas") {
      tickGasHarvest(sim, e, hq);
      return;
    }

    if (e.harvestPhase === "to_mineral") {
      if (!mineral || mineral.kind !== "mineral" || mineral.hp <= 0) {
        clearHarvest(sim, e);
        return;
      }
      const arrived = moveWorkerToward(
        sim,
        e,
        mineral.x,
        mineral.z,
        WORKER_STOP.mineral
      );
      if (arrived) {
        e.harvestPhase = "mining";
        e.mineLeft = MINERAL.harvestSec;
      }
      return;
    }

    if (e.harvestPhase === "mining") {
      if (!mineral || mineral.kind !== "mineral" || mineral.hp <= 0) {
        clearHarvest(sim, e);
        return;
      }
      e.mineLeft = (e.mineLeft || 0) - TICK_DT;
      if ((e.mineLeft || 0) > 0) return;
      if ((e.carry || 0) > 0 && e.carryKind === "gas") {
        e.harvestPhase = "to_hq";
        return;
      }
      const take = Math.min(MINERAL.carry, mineral.hp);
      if (take <= 0) {
        clearHarvest(sim, e);
        return;
      }
      mineral.hp -= take;
      e.carry = (e.carry || 0) + take;
      delete e.carryKind;
      e.harvestPhase = "to_hq";
      delete e.mineLeft;
      return;
    }

    if (e.harvestPhase === "to_hq") {
      if (!hq || hq.kind !== "hq") {
        clearHarvest(sim, e);
        return;
      }
      const arrived = moveWorkerToward(sim, e, hq.x, hq.z, WORKER_STOP.hq);
      if (!arrived) return;
      const owner = findPlayerBySide(sim, e.side);
      if (owner) depositCarry(owner, e.carry || 0, e.carryKind === "gas");
      e.carry = 0;
      delete e.carryKind;
      if (mineral && mineral.kind === "mineral" && mineral.hp > 0) {
        e.harvestPhase = "to_mineral";
      } else {
        clearHarvest(sim, e);
      }
    }
  });
}

function findPlayerBySide(sim: MatchSim, side: Side): SimPlayer | null {
  let found: SimPlayer | null = null;
  eachPlayer(sim.players, function (p) {
    if (found) return;
    if (p.side === side) found = p;
  });
  return found;
}

function inBuildZone(side: Side, x: number, z: number): boolean {
    const halfW = WORLD.halfWidth;
    if (Math.abs(x) > halfW - 0.5) return false;
  // 중앙 중립 구역: 양측 모두 건설 불가
  if (Math.abs(z) < NEUTRAL.halfDepth) return false;
    if (side === "bottom") {
    return z <= -NEUTRAL.halfDepth && z > -WORLD.halfDepth + 0.5;
  }
  return z >= NEUTRAL.halfDepth && z < WORLD.halfDepth - 0.5;
}

/** 공격 명령의 대상 좌표. 없으면 이동 방향을 본다. */
function attackAim(sim: MatchSim, e: SimEntity): { x: number; z: number } | null {
  if (e.order !== "attack" && e.order !== "attack_move") return null;
  if (!e.orderTargetId) return null;
  const target = sim.entities[e.orderTargetId];
  if (!target || target.hp <= 0) return null;
  return { x: target.x, z: target.z };
}

/** 사령부·일반 건물. 건설 중도 포함 (스타1과 동일). */
function isStructure(e: SimEntity): boolean {
  return e.kind === "hq" || e.kind === "building";
}

function sideHasStructure(sim: MatchSim, side: Side): boolean {
  let found = false;
  eachEntity(sim.entities, function (e) {
    if (found) return;
    if (e.side === side && isStructure(e)) found = true;
  });
  return found;
}

/** 양측 건물이 같은 틱에 소진되면 무승부. */
function checkElimination(sim: MatchSim): void {
  if (sim.status === "ended") return;
  const bottomOut = !sideHasStructure(sim, "bottom");
  const topOut = !sideHasStructure(sim, "top");
  if (!bottomOut && !topOut) return;
  sim.status = "ended";
  if (bottomOut && topOut) sim.winnerSide = "draw";
  else sim.winnerSide = bottomOut ? "top" : "bottom";
}

function tickConstruction(sim: MatchSim): void {
  eachEntity(sim.entities, function (e) {
    if (!e.constructing) return;
    const sec = e.buildSec || 1;
    e.buildLeft = (e.buildLeft || 0) - TICK_DT;
    const done = (e.buildLeft || 0) <= 0;
    const ratio = done ? 1 : Math.max(0, 1 - (e.buildLeft || 0) / sec);
    e.hp = Math.max(1, Math.round(e.maxHp * ratio));
    if (!done) return;
    e.constructing = false;
    e.hp = e.maxHp;
    e.buildLeft = 0;
    if (e.typeId === "monster_hatch") {
      e.larva = 0;
      e.larvaAcc = 0;
      spawnLarva(sim, e);
    }
    eachEntity(sim.entities, function (w) {
      if (w.busyOn !== e.id) return;
      ejectBuilderOutside(sim, w, e);
    });
  });
}

function tickLarva(sim: MatchSim): void {
  eachEntity(sim.entities, function (e) {
    if (!isMonsterProducer(e) || e.constructing) return;
    const n = countLarvaHome(sim, e);
    e.larva = n;
    if (n >= LARVA_CAP) {
      e.larvaAcc = 0;
      return;
    }
    e.larvaAcc = (e.larvaAcc || 0) + TICK_DT;
    if (e.larvaAcc < LARVA_SEC) return;
    e.larvaAcc -= LARVA_SEC;
    spawnLarva(sim, e);
    e.larva = n + 1;
  });
}

function isMonsterProducer(e: SimEntity): boolean {
  if (e.kind === "hq" && e.typeId.indexOf("monster") === 0) return true;
  return e.typeId === "monster_hatch";
}

function larvaBelongs(larva: SimEntity, home: SimEntity): boolean {
  if (larva.kind !== "larva" || larva.side !== home.side) return false;
  if (larva.homeId) return larva.homeId === home.id;
  return home.kind === "hq";
}

function countLarvaHome(sim: MatchSim, home: SimEntity): number {
  let n = 0;
  eachEntity(sim.entities, function (e) {
    if (larvaBelongs(e, home)) n += 1;
  });
  return n;
}

function spawnLarva(sim: MatchSim, hq: SimEntity): void {
  const front = hq.z >= 0 ? -1 : 1;
  const x = hq.x + (Math.random() - 0.5) * 2.2;
  const z = hq.z + front * (0.9 + Math.random() * 0.5);
  const ent = spawn(sim, {
    kind: "larva",
    side: hq.side,
    typeId: "monster_larva",
    x: x,
    z: z,
    hp: 1,
    maxHp: 1,
  });
  ent.homeId = hq.id;
  ent.crawlHeading = Math.random() * Math.PI * 2;
  ent.crawlTangent = Math.random() < 0.5 ? 1 : -1;
  ent.crawlSpeed = 0.18 + Math.random() * 0.28;
  ent.crawlFlip = 0.6 + Math.random() * 1.5;
  sim.entities[ent.id] = ent;
  hq.larva = countLarvaHome(sim, hq);
}

/** 해처리 앞 배회. x/z 가 곧 변태 위치다. */
function tickLarvaMove(sim: MatchSim): void {
  const ids: string[] = [];
  eachEntity(sim.entities, function (e) {
    if (e.kind === "larva") ids.push(e.id);
  });
  for (let i = 0; i < ids.length; i++) {
    const e = sim.entities[ids[i]];
    if (!e || e.kind !== "larva") continue;
    const home = e.homeId ? sim.entities[e.homeId] : null;
    const hq = home && home.hp > 0 ? home : hatcheryOf(sim, e.side);
    if (!hq) continue;
    if (typeof e.crawlHeading !== "number") {
      e.crawlHeading = Math.random() * Math.PI * 2;
      e.crawlTangent = Math.random() < 0.5 ? 1 : -1;
      e.crawlSpeed = 0.18 + Math.random() * 0.28;
      e.crawlFlip = 0.6 + Math.random() * 1.5;
    }
    const step = TICK_DT;
    const tangent = e.crawlTangent || 1;
    const speed = e.crawlSpeed || 0.25;
    e.crawlHeading = (e.crawlHeading || 0) + tangent * 0.35 * step;
    e.x += Math.cos(e.crawlHeading) * speed * step;
    e.z += Math.sin(e.crawlHeading) * speed * step;
    const front = hq.z >= 0 ? -1 : 1;
    const near = hq.z + front * 0.78;
    const far = hq.z + front * 1.15;
    const minZ = near < far ? near : far;
    const maxZ = near < far ? far : near;
    const minX = hq.x - 1.25;
    const maxX = hq.x + 1.25;
    if (e.x < minX || e.x > maxX) {
      e.x = e.x < minX ? minX : maxX;
      e.crawlHeading = Math.PI - (e.crawlHeading || 0);
    }
    if (e.z < minZ || e.z > maxZ) {
      e.z = e.z < minZ ? minZ : maxZ;
      e.crawlHeading = -(e.crawlHeading || 0);
    }
    e.crawlFlip = (e.crawlFlip || 0) - step;
    if ((e.crawlFlip || 0) <= 0) {
      e.crawlTangent = Math.random() < 0.5 ? 1 : -1;
      e.crawlHeading = (e.crawlHeading || 0) + (Math.random() - 0.5) * 1.4;
      e.crawlSpeed = 0.18 + Math.random() * 0.28;
      e.crawlFlip = 0.6 + Math.random() * 1.5;
    }
    replaceEntity(sim, e);
  }
}

function listLarva(sim: MatchSim, side: Side): SimEntity[] {
  const list: SimEntity[] = [];
  eachEntity(sim.entities, function (e) {
    if (e.kind === "larva" && e.side === side) list.push(e);
  });
  return list;
}

function listLarvaHome(sim: MatchSim, home: SimEntity): SimEntity[] {
  const list: SimEntity[] = [];
  eachEntity(sim.entities, function (e) {
    if (larvaBelongs(e, home)) list.push(e);
  });
  return list;
}

/** larvaIds 가 있으면 그 유충만, 없으면 진영의 모든 유충. */
function larvaTargets(
  sim: MatchSim,
  side: Side,
  larvaIds: string[] | undefined
): SimEntity[] {
  const ids = copyStrArr(larvaIds);
  if (ids.length === 0) return listLarva(sim, side);
  const out: SimEntity[] = [];
  for (let i = 0; i < ids.length; i++) {
    const e = sim.entities[ids[i]];
    if (e && e.kind === "larva" && e.side === side) out.push(e);
  }
  return out;
}

/** SC1: 유충 → 알. 대기열 없이 해당 위치에서 변태. */
function beginMorph(
  sim: MatchSim,
  larva: SimEntity,
  unitType: string,
  time: number
): void {
  larva.kind = "egg";
  larva.typeId = "monster_egg";
  larva.morphType = unitType;
  larva.morphLeft = time;
  larva.morphSec = time;
  larva.hp = 200;
  larva.maxHp = 200;
  replaceEntity(sim, larva);
  const home = larva.homeId ? sim.entities[larva.homeId] : hatcheryOf(sim, larva.side);
  if (home) home.larva = countLarvaHome(sim, home);
}

function tickEggs(sim: MatchSim): void {
  const done: string[] = [];
  eachEntity(sim.entities, function (e) {
    if (e.kind !== "egg") return;
    e.morphLeft = (e.morphLeft || 0) - TICK_DT;
    if ((e.morphLeft || 0) > 0) return;
    done.push(e.id);
  });
  for (let i = 0; i < done.length; i++) {
    const egg = sim.entities[done[i]];
    if (egg && egg.kind === "egg") hatchEgg(sim, egg);
  }
}

function hatchEgg(sim: MatchSim, egg: SimEntity): void {
  const typeId = egg.morphType || "monster_worker";
  const side = egg.side;
  const x = egg.x;
  const z = egg.z;
  const homeId = egg.homeId;
  const def = unitDef(typeId);
  const hp = unitMaxHp(typeId);
  const isWorker = typeId.indexOf("worker") >= 0;
  const home = homeId ? sim.entities[homeId] : null;
  const hq = home && home.hp > 0 ? home : hatcheryOf(sim, side);
  const hasRally =
    hq && isFiniteNum(hq.rallyX) && isFiniteNum(hq.rallyZ);
  const kind = isWorker ? "worker" : "unit";
  const count = typeId === "monster_blade" ? 2 : 1;
  // 전투 유닛과 일꾼 모두 소속 산란소 랠리로 이동한다.
  const rally = hasRally && hq ? hq : null;
  // 알 id 를 첫 유닛이 물려받는다. 선택 중이던 알이 그 유닛으로 이어진다.
  delete egg.morphType;
  delete egg.morphLeft;
  delete egg.morphSec;
  delete egg.homeId;
  egg.kind = kind;
  egg.typeId = typeId;
  egg.hp = def ? hp : 40;
  egg.maxHp = hp;
  if (count === 2) egg.x = x - 0.16;
  if (rally) {
    egg.order = "move";
    egg.orderX = rally.rallyX;
    egg.orderZ = rally.rallyZ;
  }
  replaceEntity(sim, egg);
  if (count === 2) {
    const twin = spawn(sim, {
      kind: kind,
      side: side,
      typeId: typeId,
      x: x + 0.16,
      z: z,
      hp: def ? hp : 40,
      maxHp: hp,
      order: rally ? "move" : undefined,
      orderX: rally ? rally.rallyX : undefined,
      orderZ: rally ? rally.rallyZ : undefined,
    });
    twin.hatchOf = egg.id;
    replaceEntity(sim, twin);
  }
  noteUnitsMade(sim, side, count);
  if (hq) hq.larva = countLarvaHome(sim, hq);
}

function cancelMorph(
  sim: MatchSim,
  player: SimPlayer,
  eggId: string
): void {
  const egg = sim.entities[eggId];
  if (!egg || egg.kind !== "egg" || egg.side !== player.side) return;
  const def = egg.morphType ? unitDef(egg.morphType) : null;
  if (def) refundCost(player, def.costM, def.costE);
  // SC1: 취소 시 알(유충) 파괴 — 유충 복구 없음
  delete sim.entities[eggId];
  const home = egg.homeId ? sim.entities[egg.homeId] : hatcheryOf(sim, player.side);
  if (home) home.larva = countLarvaHome(sim, home);
}

function tickProduction(sim: MatchSim): void {
  eachEntity(sim.entities, function (e) {
    // 괴물 HQ는 알 변태로 생산 — 건물 큐 미사용
    if (e.kind === "hq" && e.typeId.indexOf("monster") === 0) return;
    const queue = copyStrArr(e.queue);
    if (queue.length === 0 || e.constructing) return;
    // Goja 래퍼 length가 어긋날 수 있어 네이티브 복사본을 다시 붙인다.
    e.queue = queue;
    if (typeof e.prodLeft !== "number" || e.prodLeft <= 0) {
      const first = unitDef(queue[0]);
      e.prodLeft = first ? first.time : 1;
    }
    e.prodLeft = (e.prodLeft || 0) - TICK_DT;
    if ((e.prodLeft || 0) > 0) return;
    const typeId = queue[0];
    const rest = copyStrArr(queue);
    rest.splice(0, 1);
    e.queue = rest;
    spawnProduced(sim, e, typeId);
    const next = rest.length > 0 ? unitDef(rest[0]) : null;
    e.prodLeft = next ? next.time : 0;
  });
}

/** HQ·건물 footprint 반경(월드). HQ는 FOOTPRINT.hq(6×6). */
function entityHalfExtents(e: SimEntity): { x: number; z: number } {
  if (e.kind === "hq") {
    return {
      x: (FOOTPRINT.hq.w * MAP.cellSize) / 2,
      z: (FOOTPRINT.hq.d * MAP.cellSize) / 2,
    };
  }
  const fp = footprintOf(e.typeId);
  return { x: (fp.w * MAP.cellSize) / 2, z: (fp.d * MAP.cellSize) / 2 };
}

/** 건물 앞 기본 생산(출구) 위치 — footprint 바깥. */
function defaultSpawnPos(
  from: SimEntity,
  spread: number
): { x: number; z: number } {
  const toward = from.side === "bottom" ? 1 : -1;
  const half = entityHalfExtents(from);
  const exit = half.z + MAP.cellSize * 0.9;
  return { x: from.x + spread, z: from.z + toward * exit };
}

export function hasRallyPoint(e: SimEntity): boolean {
  return isFiniteNum(e.rallyX) && isFiniteNum(e.rallyZ);
}

/**
 * 생산 완료 스폰.
 * 그 건물에 랠리가 있으면 일꾼·전투 유닛 모두 그 점으로 이동한다.
 * 랠리가 없으면 출구에서 대기한다. 다른 건물의 랠리는 쓰지 않는다.
 */
function spawnProduced(sim: MatchSim, from: SimEntity, typeId: string): void {
  const def = unitDef(typeId);
  const hp = unitMaxHp(typeId);
  const spread = ((sim.nextId % 5) - 2) * 0.2;
  const gate = defaultSpawnPos(from, spread);
  // 생산 건물은 매 틱 replace 될 수 있어 최신 참조에서 랠리를 읽는다.
  const producer = sim.entities[from.id] || from;
  const rallyX = producer.rallyX;
  const rallyZ = producer.rallyZ;
  const hasRally = isFiniteNum(rallyX) && isFiniteNum(rallyZ);
  const kind = typeId.indexOf("worker") >= 0 ? "worker" : "unit";
  if (hasRally) {
    spawn(sim, {
      kind: kind,
      side: from.side,
      typeId: typeId,
      x: gate.x,
      z: gate.z,
      hp: def ? hp : 40,
      maxHp: hp,
      order: "move",
      orderX: rallyX,
      orderZ: rallyZ,
    });
    noteUnitsMade(sim, from.side, 1);
    return;
  }
  spawn(sim, {
    kind: kind,
    side: from.side,
    typeId: typeId,
    x: gate.x,
    z: gate.z,
    hp: def ? hp : 40,
    maxHp: hp,
  });
  noteUnitsMade(sim, from.side, 1);
}

function enqueueUnit(
  sim: MatchSim,
  player: SimPlayer,
  buildingId: string,
  unitType: string,
  larvaIds?: string[]
): void {
  const def = unitDef(unitType);
  if (!def) return;

  // SC1 괴물: 유충 자리에서 알로 변태. 자원·인구가 되는 만큼만.
  if (def.larva) {
    const clicked = sim.entities[buildingId];
    const hq =
      clicked && isMonsterProducer(clicked)
        ? clicked
        : hatcheryOf(sim, player.side);
    if (!hq || hq.constructing) return;
    if (!canProduce(sim, player, hq, unitType)) return;
    const picked = copyStrArr(larvaIds);
    const targets =
      picked.length > 0
        ? larvaTargets(sim, player.side, picked)
        : listLarvaHome(sim, hq);
    for (let i = 0; i < targets.length; i++) {
      const larva = sim.entities[targets[i].id];
      if (!larva || larva.kind !== "larva") continue;
      const supply = supplyState(sim, player);
      if (supply.used + def.supply > supply.max) break;
      if (player.energy < def.costE || player.minerals < def.costM) break;
      spendCost(player, def.costM, def.costE);
      beginMorph(sim, larva, unitType, def.time);
    }
    return;
  }

  const source = sim.entities[buildingId];
  if (!source || source.side !== player.side) return;
  if (source.constructing) return;
  if (!canProduce(sim, player, source, unitType)) return;
  const supply = supplyState(sim, player);
  if (supply.used + def.supply > supply.max) return;
  if (player.energy < def.costE || player.minerals < def.costM) return;

  const queue = copyStrArr(source.queue);
  if (queue.length >= 5) return;
  queue.push(unitType);
  spendCost(player, def.costM, def.costE);
  // 반드시 새 배열을 필드에 재할당 (Goja에서 in-place push는 유실됨)
  source.queue = queue;
  if (queue.length === 1) source.prodLeft = def.time;
}

function cancelQueue(
  sim: MatchSim,
  player: SimPlayer,
  buildingId: string,
  queueIndex: number
): void {
  const source = sim.entities[buildingId];
  if (!source || source.side !== player.side) return;
  // 괴물 HQ는 알 취소(cancel_morph)만 사용
  if (source.kind === "hq" && source.typeId.indexOf("monster") === 0) return;
  const queue = copyStrArr(source.queue);
  if (queueIndex < 0 || queueIndex >= queue.length) return;
  const typeId = queue[queueIndex];
  const def = unitDef(typeId);
  const rest: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    if (i !== queueIndex) rest.push(queue[i]);
  }
  source.queue = rest;
  if (queueIndex === 0) {
    const next = rest.length > 0 ? unitDef(rest[0]) : null;
    source.prodLeft = next ? next.time : 0;
  }
  if (!def) return;
  refundCost(player, def.costM, def.costE);
}

function canProduce(
  sim: MatchSim,
  player: SimPlayer,
  source: SimEntity,
  unitType: string
): boolean {
  const def = unitDef(unitType);
  if (!def || def.race !== player.race) return false;
  const place = source.kind === "hq" ? "hq" : source.typeId;
  if (!unitProducedAt(unitType, place)) return false;
  if (def.needs && !hasReady(sim, player.side, def.needs)) return false;
  return true;
}

function hasReady(sim: MatchSim, side: Side, typeId: string): boolean {
  let ok = false;
  eachEntity(sim.entities, function (e) {
    if (ok) return;
    if (e.side === side && e.typeId === typeId && e.kind === "building" && !e.constructing) {
      ok = true;
    }
  });
  return ok;
}

function hatcheryOf(sim: MatchSim, side: Side): SimEntity | null {
  let found: SimEntity | null = null;
  eachEntity(sim.entities, function (e) {
    if (found) return;
    if (e.kind === "hq" && e.side === side) found = e;
  });
  return found;
}

function supplyState(sim: MatchSim, player: SimPlayer): { used: number; max: number } {
  let used = 0;
  let bonus = 0;
  let blades = 0;
  eachEntity(sim.entities, function (e) {
    if (e.side !== player.side) return;
    if (e.kind === "worker") used += 1;
    else if (e.kind === "unit" && e.typeId === "monster_blade") blades += 1;
    else if (e.kind === "unit" && e.typeId !== "monster_sac") used += 1;
    else if (e.kind === "egg" && e.morphType) {
      // 알로 변태하는 순간부터 해당 유닛 인구를 예약한다.
      const morph = unitDef(e.morphType);
      if (morph) used += morph.supply;
    }
    if (e.typeId === "monster_sac") bonus += SUPPLY_BONUS;
    if (!e.constructing && (e.typeId === "human_depot" || e.typeId === "alien_pylon")) {
      bonus += SUPPLY_BONUS;
    }
  });
  const base = player.race === "monster" ? 0 : 10;
  // 칼날충 실개체는 2기 = 인구 1. 알은 morph.supply(1)로 이미 잡음.
  used += Math.ceil(blades / 2);
  return { used: used, max: Math.min(SUPPLY_CAP, base + bonus) };
}

/** Grid helpers for later placement validation. */
export function worldToCell(x: number, z: number): { cx: number; cz: number } {
  const cx = Math.floor((x + WORLD.halfWidth) / MAP.cellSize);
  const cz = Math.floor((z + WORLD.halfDepth) / MAP.cellSize);
  return { cx: cx, cz: cz };
}
