import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, Socket } from "@heroiclabs/nakama-js";
import {
  clearStoredSession,
  createNakamaClient,
  ensureConnection,
  onConnectionChange,
  resetConnection,
} from "./net/nakamaClient";
import { ensureAccountDisplayName } from "./player/profile";
import { createRoom, quickJoin } from "./net/roomsApi";
import { BattleHud, battleQueuePlaceholder } from "./screens/BattleHud";
import { BootScreen, ErrorScreen } from "./screens/BootScreen";
import { previewEnemy, previewEntities, previewMe } from "./screens/fixtures";
import { LobbyScreen } from "./screens/LobbyScreen";
import { MatchingScreen, WaitingScreen } from "./screens/MatchFlowScreens";
import { ResultScreen } from "./screens/ResultScreen";
import { OpCode, type MatchSnapshot, type PlayerInput, type RaceId } from "./protocol";
import type { RoomRecord } from "./protocol/rooms";
import { GameScene, LobbyScene } from "./scenes/scenes";
import {
  clearSnapshot,
  pushSnapshot,
  shouldMirrorToReact,
} from "./game/snapshotStore";
import { issueClientRallyOrders } from "./game/clientRally";
import { formationPoints } from "./game/formation";
import { MAX_SELECT } from "./game/pick";
import { preloadBattleAssets } from "./game/sprites";

type ConnState = "booting" | "ready" | "matching" | "in_match" | "error";
type MatchPhase = "search" | "join";

const RACE_KEY = "starfront_race";

function loadRace(): RaceId {
  const saved = localStorage.getItem(RACE_KEY);
  if (saved === "human" || saved === "monster" || saved === "alien") return saved;
  return "human";
}

function devPreview(): "battle" | "result" | "matching" | null {
  if (!import.meta.env.DEV) return null;
  const value = new URLSearchParams(window.location.search).get("ui");
  if (value === "battle" || value === "result" || value === "matching") return value;
  return null;
}

function orderLobbyPlayers(
  players: MatchSnapshot["players"],
  hostUserId?: string
) {
  return [...players].sort((a, b) => {
    if (hostUserId) {
      if (a.userId === hostUserId) return -1;
      if (b.userId === hostUserId) return 1;
    }
    if (a.side === b.side) return 0;
    return a.side === "bottom" ? -1 : 1;
  });
}

export default function App() {
  const preview = useMemo(() => devPreview(), []);
  const client = useMemo(() => createNakamaClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [conn, setConn] = useState<ConnState>("booting");
  const [error, setError] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<RoomRecord | null>(null);
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [race, setRace] = useState<RaceId>(() => loadRace());
  const [phase, setPhase] = useState<MatchPhase>("search");
  const [bootNonce, setBootNonce] = useState(0);
  const [placeType, setPlaceType] = useState<string | null>(null);
  const [placeWorkerId, setPlaceWorkerId] = useState<string | null>(null);
  const [harvestWorkerIds, setHarvestWorkerIds] = useState<string[]>([]);
  const [rallyBuildingId, setRallyBuildingId] = useState<string | null>(null);
  const [moveUnitIds, setMoveUnitIds] = useState<string[]>([]);
  const [attackUnitIds, setAttackUnitIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewNonce, setPreviewNonce] = useState(0);

  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  const selectEntity = useCallback((ids: string[]) => {
    const next = ids.slice(0, MAX_SELECT);
    const prev = selectedIdsRef.current;
    const same =
      prev.length === next.length && prev.every((id, i) => id === next[i]);
    if (same) return;
    selectedIdsRef.current = next;
    setSelectedIds(next);
    setPlaceType(null);
    setPlaceWorkerId(null);
    setHarvestWorkerIds([]);
    setRallyBuildingId((cur) => (cur && next.includes(cur) ? cur : null));
    setMoveUnitIds([]);
    setAttackUnitIds([]);
  }, []);

  const armHarvest = useCallback((workerIds: string[] | null) => {
    setPlaceType(null);
    setPlaceWorkerId(null);
    setRallyBuildingId(null);
    setMoveUnitIds([]);
    setAttackUnitIds([]);
    setHarvestWorkerIds(workerIds?.length ? workerIds : []);
  }, []);

  const armRally = useCallback((buildingId: string | null) => {
    setPlaceType(null);
    setPlaceWorkerId(null);
    setHarvestWorkerIds([]);
    setMoveUnitIds([]);
    setAttackUnitIds([]);
    if (buildingId == null) {
      setRallyBuildingId(null);
      return;
    }
    // 같은 건물에서 다시 누르면 랠리 무장 해제
    setRallyBuildingId((cur) => (cur === buildingId ? null : buildingId));
  }, []);

  const clearRally = useCallback(
    (buildingId: string) => {
      setRallyBuildingId(null);
      if (preview) {
        const e = previewEntities.find((ent) => ent.id === buildingId);
        if (e) {
          delete e.rallyX;
          delete e.rallyZ;
          setPreviewNonce((n) => n + 1);
        }
        return;
      }
      // 서버 스냅샷이 권위 — 낙관적 패치는 HUD/월드 불일치를 만든다.
      if (!matchId) return;
      sendInputTo(matchId, { type: "clear_rally", buildingId });
    },
    [preview, matchId]
  );

  const armMove = useCallback((unitIds: string[] | null) => {
    setPlaceType(null);
    setPlaceWorkerId(null);
    setHarvestWorkerIds([]);
    setRallyBuildingId(null);
    setAttackUnitIds([]);
    setMoveUnitIds(unitIds?.length ? unitIds : []);
  }, []);

  const armAttack = useCallback((unitIds: string[] | null) => {
    setPlaceType(null);
    setPlaceWorkerId(null);
    setHarvestWorkerIds([]);
    setRallyBuildingId(null);
    setMoveUnitIds([]);
    setAttackUnitIds(unitIds?.length ? unitIds : []);
  }, []);

  const armPlace = useCallback((typeId: string | null, workerId?: string | null) => {
    setHarvestWorkerIds([]);
    setRallyBuildingId(null);
    setMoveUnitIds([]);
    setAttackUnitIds([]);
    setPlaceType(typeId);
    setPlaceWorkerId(typeId && workerId ? workerId : null);
  }, []);
  const raceRef = useRef(race);
  raceRef.current = race;
  const hudMirrorAtRef = useRef(0);
  const snapshotRef = useRef<MatchSnapshot | null>(null);
  const matchIdRef = useRef<string | null>(null);
  matchIdRef.current = matchId;
  const sessionUserIdRef = useRef<string>("");
  sessionUserIdRef.current = session?.user_id ?? "";
  const seenEntityIdsRef = useRef<Set<string>>(new Set());
  const prevMatchStatusRef = useRef<MatchSnapshot["status"] | undefined>(
    undefined
  );

  const chooseRace = useCallback(
    (next: RaceId) => {
      setRace(next);
      localStorage.setItem(RACE_KEY, next);
      if (matchId && snapshot?.status === "waiting") {
        sendInputToRef.current?.(matchId, { type: "set_race", race: next });
      }
    },
    [matchId, snapshot?.status]
  );

  const sendInputToRef = useRef<(id: string, input: PlayerInput) => void>(
    undefined
  );

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    (async () => {
      try {
        if (bootNonce > 0) {
          resetConnection();
          clearStoredSession();
        }
        const { session: s, socket: sock } = await ensureConnection(client);
        if (cancelled) return;
        try {
          await ensureAccountDisplayName(client, s);
        } catch {
          // 닉네임 초기화 실패해도 로비 진입은 허용
        }
        if (cancelled) return;
        setSession(s);
        setSocket(sock);
        setConn((prev) => (prev === "booting" || prev === "error" ? "ready" : prev));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setConn("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, bootNonce, preview]);

  useEffect(() => {
    if (preview) return;
    return onConnectionChange(({ session: s, socket: sock }) => {
      setSession(s);
      setSocket(sock);
    });
  }, [preview]);

  const sendInputTo = useCallback(
    (id: string, input: PlayerInput) => {
      if (!socket) return;
      const payload = new TextEncoder().encode(JSON.stringify(input));
      void socket.sendMatchState(id, OpCode.INPUT, payload);
    },
    [socket]
  );
  sendInputToRef.current = sendInputTo;

  const resetBattleUi = useCallback(() => {
    setPlaceType(null);
    setPlaceWorkerId(null);
    setHarvestWorkerIds([]);
    setRallyBuildingId(null);
    setMoveUnitIds([]);
    setAttackUnitIds([]);
    setSelectedIds([]);
    selectedIdsRef.current = [];
  }, []);

  const enterMatch = useCallback(
    async (id: string, room?: RoomRecord | null) => {
      if (!socket) return;
      setError(null);
      setConn("matching");
      setPhase("join");
      try {
        const match = await socket.joinMatch(id);
        setMatchId(match.match_id);
        matchIdRef.current = match.match_id;
        setActiveRoom(room ?? null);
        clearSnapshot();
        snapshotRef.current = null;
        setSnapshot(null);
        seenEntityIdsRef.current = new Set();
        resetBattleUi();
        setConn("in_match");
        // 대기·카운트다운 동안 스프라이트를 미리 받아 전투 시작 흰 깜빡임을 줄인다
        void preloadBattleAssets();
        sendInputTo(match.match_id, { type: "set_race", race: raceRef.current });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setConn("ready");
      }
    },
    [socket, sendInputTo, resetBattleUi]
  );

  // 카운트다운→플레이 전환 시 이전 판 UI(랠리 무장 등)를 비운다.
  useEffect(() => {
    const status = snapshot?.status;
    const prev = prevMatchStatusRef.current;
    prevMatchStatusRef.current = status;
    if (
      status === "playing" &&
      (prev === "countdown" || prev === "waiting" || prev === "ended")
    ) {
      seenEntityIdsRef.current = new Set();
      resetBattleUi();
    }
  }, [snapshot?.status, resetBattleUi]);

  useEffect(() => {
    if (!socket) return;

    socket.onmatchdata = (matchData) => {
      const dataMatchId =
        (matchData as { match_id?: string; matchId?: string }).match_id ||
        (matchData as { matchId?: string }).matchId;
      // 이전 매치의 지연 스냅샷이 새 게임을 덮지 않게 한다.
      if (dataMatchId && matchIdRef.current && dataMatchId !== matchIdRef.current) {
        return;
      }
      const code = matchData.op_code;
      const text = new TextDecoder().decode(matchData.data);
      if (code === OpCode.SNAPSHOT || code === OpCode.MATCH_END) {
        try {
          const parsed = JSON.parse(text) as MatchSnapshot | { snapshot: MatchSnapshot };
          const snap =
            "protocolVersion" in parsed
              ? parsed
              : (parsed as { snapshot: MatchSnapshot }).snapshot;
          // 월드는 스토어로 즉시 전달(보간). React HUD는 스로틀.
          pushSnapshot(snap);
          const mid = matchIdRef.current;
          const uid = sessionUserIdRef.current;
          if (mid && uid) {
            issueClientRallyOrders(snap, {
              userId: uid,
              matchId: mid,
              seenIds: seenEntityIdsRef.current,
              send: (id, input) => sendInputToRef.current?.(id, input),
            });
          }
          const now = performance.now();
          if (
            shouldMirrorToReact(
              snapshotRef.current,
              snap,
              hudMirrorAtRef.current,
              now
            )
          ) {
            hudMirrorAtRef.current = now;
            snapshotRef.current = snap;
            setSnapshot(snap);
          }
        } catch {
          // ignore malformed payloads
        }
      }
    };

    return () => {
      socket.onmatchdata = () => undefined;
    };
  }, [socket]);

  /** 빠른 시작 = 빈/대기 공개방에 자동 입장 (없으면 생성) */
  const findMatch = useCallback(async () => {
    if (!session) return;
    setPhase("search");
    setConn("matching");
    setError(null);
    setActiveRoom(null);
    try {
      const room = await quickJoin(client, session);
      await enterMatch(room.matchId, room);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConn("ready");
    }
  }, [session, client, enterMatch]);

  const cancelMatch = useCallback(() => {
    setConn("ready");
  }, []);

  const leaveToLobby = useCallback(async () => {
    if (socket && matchId) {
      try {
        await socket.leaveMatch(matchId);
      } catch {
        // 종료된 매치
      }
    }
    setMatchId(null);
    matchIdRef.current = null;
    seenEntityIdsRef.current = new Set();
    clearSnapshot();
    snapshotRef.current = null;
    setSnapshot(null);
    setActiveRoom(null);
    resetBattleUi();
    setConn("ready");
  }, [socket, matchId, resetBattleUi]);

  const createAndEnter = useCallback(
    async (name: string) => {
      if (!session) return;
      setPhase("join");
      setConn("matching");
      setError(null);
      try {
        const room = await createRoom(client, session, name, true);
        await enterMatch(room.matchId, room);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setConn("ready");
      }
    },
    [session, client, enterMatch]
  );

  const me =
    snapshot?.players.find((p) => p.userId === session?.user_id) ?? snapshot?.players[0];
  const enemy = snapshot?.players.find((p) => p !== me);
  const stageRace = me?.race ?? race;
  const hostUserId = snapshot?.hostUserId ?? activeRoom?.hostUserId;
  const lobbyPlayers = snapshot
    ? orderLobbyPlayers(snapshot.players, hostUserId)
    : [];
  const canStart =
    !!session?.user_id &&
    session.user_id === hostUserId &&
    lobbyPlayers.length >= 2 &&
    snapshot?.status === "waiting";

  const joinRoom = (id: string, room: RoomRecord) => {
    setPhase("join");
    return enterMatch(id, room);
  };

  let screen: ReactNode = null;
  if (preview === "battle") {
    screen = (
      <BattleHud
        me={previewMe}
        enemy={previewEnemy}
        entities={previewEntities}
        queue={battleQueuePlaceholder(previewMe.race)}
        onProduce={() => undefined}
        placeType={placeType}
        onArmPlace={armPlace}
        harvestWorkerIds={harvestWorkerIds}
        onArmHarvest={armHarvest}
        rallyBuildingId={rallyBuildingId}
        onArmRally={armRally}
        onClearRally={clearRally}
        moveUnitIds={moveUnitIds}
        onArmMove={armMove}
        attackUnitIds={attackUnitIds}
        onArmAttack={armAttack}
        selectedIds={selectedIds}
        onSelect={selectEntity}
      />
    );
  } else if (preview === "result") {
    screen = (
      <ResultScreen
        me={previewMe}
        enemy={previewEnemy}
        entities={previewEntities}
        winnerSide="bottom"
        playSec={754}
        onLobby={() => undefined}
      />
    );
  } else if (preview === "matching") {
    screen = <MatchingScreen phase="search" onCancel={() => undefined} />;
  } else if (conn === "booting") {
    screen = <BootScreen />;
  } else if (conn === "error") {
    screen = (
      <ErrorScreen
        message={error ?? "알 수 없는 오류"}
        onRetry={() => {
          setError(null);
          setConn("booting");
          setBootNonce((n) => n + 1);
        }}
      />
    );
  } else if (conn === "matching") {
    screen = <MatchingScreen phase={phase} onCancel={cancelMatch} />;
  } else if (conn === "in_match" && snapshot?.status === "ended") {
    screen = (
      <ResultScreen
        me={me}
        enemy={enemy}
        entities={snapshot.entities}
        winnerSide={snapshot.winnerSide}
        playSec={snapshot.playSec}
        onLobby={() => void leaveToLobby()}
      />
    );
  } else if (conn === "in_match" && snapshot?.status === "playing" && me) {
    screen = (
      <BattleHud
        me={me}
        enemy={enemy}
        entities={snapshot.entities}
        onProduce={(buildingId, unitType, larvaIds) => {
          if (!matchId) return;
          sendInputTo(matchId, {
            type: "enqueue_unit",
            buildingId,
            unitType,
            larvaIds,
          });
        }}
        onCancelQueue={(buildingId, queueIndex) => {
          if (!matchId) return;
          sendInputTo(matchId, { type: "cancel_queue", buildingId, queueIndex });
        }}
        onCancelMorph={(eggId) => {
          if (!matchId) return;
          sendInputTo(matchId, { type: "cancel_morph", eggId });
        }}
        placeType={placeType}
        onArmPlace={armPlace}
        harvestWorkerIds={harvestWorkerIds}
        onArmHarvest={armHarvest}
        rallyBuildingId={rallyBuildingId}
        onArmRally={armRally}
        onClearRally={clearRally}
        moveUnitIds={moveUnitIds}
        onArmMove={armMove}
        attackUnitIds={attackUnitIds}
        onArmAttack={armAttack}
        selectedIds={selectedIds}
        onSelect={selectEntity}
      />
    );
  } else if (
    conn === "in_match" &&
    (!snapshot ||
      snapshot.status === "waiting" ||
      snapshot.status === "countdown")
  ) {
    screen = (
      <WaitingScreen
        roomName={snapshot?.roomName || activeRoom?.name}
        inviteCode={snapshot?.inviteCode || activeRoom?.inviteCode}
        players={lobbyPlayers}
        hostUserId={hostUserId}
        localUserId={session?.user_id}
        race={race}
        onRace={chooseRace}
        countdown={
          snapshot?.status === "countdown"
            ? snapshot.countdown ?? 5
            : undefined
        }
        canStart={canStart}
        onStart={() => {
          if (!matchId) return;
          sendInputTo(matchId, { type: "host_start" });
        }}
        onLeave={() => void leaveToLobby()}
      />
    );
  } else if (session) {
    screen = (
      <LobbyScreen
        client={client}
        session={session}
        race={race}
        onRace={chooseRace}
        onQuickMatch={() => void findMatch()}
        onEnterMatch={joinRoom}
        onCreateRoom={(name) => void createAndEnter(name)}
        externalError={error}
      />
    );
  }

  const stageRaceShown =
    preview === "battle" || preview === "result" ? "human" : stageRace;
  const inBattle =
    preview === "battle" ||
    preview === "result" ||
    (!preview &&
      conn === "in_match" &&
      (snapshot?.status === "playing" || snapshot?.status === "ended"));

  if (inBattle) {
    return (
      <GameScene
        race={stageRaceShown}
        snapshot={
          preview === "battle" || preview === "result"
            ? {
                protocolVersion: 1,
                tick: previewNonce,
                status: preview === "result" ? "ended" : "playing",
                winnerSide: preview === "result" ? "bottom" : undefined,
                players: [previewMe, previewEnemy],
                entities: previewEntities.map((e) => ({ ...e })),
              }
            : snapshot
        }
        entities={
          preview === "battle" || preview === "result"
            ? previewEntities
            : undefined
        }
        localSide={preview ? "bottom" : (me?.side ?? null)}
        placing={!!placeType && (preview === "battle" || snapshot?.status === "playing")}
        placeType={placeType}
        placeWorkerId={
          preview === "battle" || snapshot?.status === "playing"
            ? placeWorkerId
            : null
        }
        harvestWorkerIds={
          preview === "battle" || snapshot?.status === "playing"
            ? harvestWorkerIds
            : []
        }
        rallyBuildingId={
          preview === "battle" || snapshot?.status === "playing"
            ? rallyBuildingId
            : null
        }
        moveUnitIds={
          preview === "battle" || snapshot?.status === "playing"
            ? moveUnitIds
            : []
        }
        attackUnitIds={
          preview === "battle" || snapshot?.status === "playing"
            ? attackUnitIds
            : []
        }
        selectedIds={selectedIds}
        onSelect={selectEntity}
        onCancelPlace={() => {
          setPlaceType(null);
          setPlaceWorkerId(null);
        }}
        onHarvestMineral={(mineralId) => {
          const workerIds = harvestWorkerIds.slice();
          setHarvestWorkerIds([]);
          if (!workerIds.length) return;
          if (preview) {
            setPreviewNonce((n) => n + 1);
            return;
          }
          if (!matchId) return;
          for (let i = 0; i < workerIds.length; i++) {
            sendInputTo(matchId, {
              type: "order_harvest",
              workerId: workerIds[i],
              mineralId,
            });
          }
        }}
        onCancelHarvest={() => setHarvestWorkerIds([])}
        onSetRally={(buildingId, x, z) => {
          setRallyBuildingId(null);
          if (preview) {
            const e = previewEntities.find((ent) => ent.id === buildingId);
            if (e) {
              e.rallyX = x;
              e.rallyZ = z;
              setPreviewNonce((n) => n + 1);
            }
            return;
          }
          // 서버 확정 스냅샷만 표시 (낙관적 패치 시 미반영 랠리로 생산 유닛이 안 움직임)
          if (!matchId) return;
          sendInputTo(matchId, {
            type: "set_rally",
            buildingId,
            x: Number(x),
            z: Number(z),
          });
        }}
        onCancelRally={() => setRallyBuildingId(null)}
        onOrderMove={(unitIds, x, z) => {
          setMoveUnitIds([]);
          if (!unitIds.length) return;
          const ents =
            preview === "battle" || preview === "result"
              ? previewEntities
              : (snapshot?.entities ?? []);
          const dests = formationPoints(ents, unitIds, x, z);
          if (preview) {
            for (let i = 0; i < unitIds.length; i++) {
              const e = previewEntities.find((ent) => ent.id === unitIds[i]);
              if (e) {
                e.x = dests[i].x;
                e.z = dests[i].z;
              }
            }
            setPreviewNonce((n) => n + 1);
            return;
          }
          if (!matchId) return;
          for (let i = 0; i < unitIds.length; i++) {
            sendInputTo(matchId, {
              type: "order_move",
              unitId: unitIds[i],
              x: dests[i].x,
              z: dests[i].z,
            });
          }
        }}
        onCancelMove={() => setMoveUnitIds([])}
        onOrderAttack={(unitIds, targetId) => {
          setAttackUnitIds([]);
          if (!unitIds.length) return;
          if (preview) {
            const target = previewEntities.find((ent) => ent.id === targetId);
            if (target) {
              target.hp = Math.max(0, target.hp - 8 * unitIds.length);
              setPreviewNonce((n) => n + 1);
            }
            return;
          }
          if (!matchId) return;
          for (let i = 0; i < unitIds.length; i++) {
            sendInputTo(matchId, {
              type: "order_attack",
              unitId: unitIds[i],
              targetId,
            });
          }
        }}
        onOrderAttackMove={(unitIds, x, z) => {
          setAttackUnitIds([]);
          if (!unitIds.length) return;
          const ents =
            preview === "battle" || preview === "result"
              ? previewEntities
              : (snapshot?.entities ?? []);
          const dests = formationPoints(ents, unitIds, x, z);
          if (preview) {
            for (let i = 0; i < unitIds.length; i++) {
              const e = previewEntities.find((ent) => ent.id === unitIds[i]);
              if (e) {
                e.x = dests[i].x;
                e.z = dests[i].z;
              }
            }
            setPreviewNonce((n) => n + 1);
            return;
          }
          if (!matchId) return;
          for (let i = 0; i < unitIds.length; i++) {
            sendInputTo(matchId, {
              type: "order_attack_move",
              unitId: unitIds[i],
              x: dests[i].x,
              z: dests[i].z,
            });
          }
        }}
        onCancelAttack={() => setAttackUnitIds([])}
        onPlaceAt={(x, z) => {
          const buildingType = placeType;
          const workerId = placeWorkerId;
          setPlaceType(null);
          setPlaceWorkerId(null);
          if (!matchId || preview || !buildingType || !workerId) return;
          sendInputTo(matchId, {
            type: "place_building",
            buildingType,
            x,
            z,
            workerId,
          });
        }}
      >
        {screen}
      </GameScene>
    );
  }

  return <LobbyScene race={stageRaceShown}>{screen}</LobbyScene>;
}
