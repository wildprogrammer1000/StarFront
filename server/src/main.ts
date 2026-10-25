/// <reference path="./nakama.d.ts" />

import { MATCH_MODULE } from "./match/constants";
import {
  matchInit,
  matchJoin,
  matchJoinAttempt,
  matchLeave,
  matchLoop,
  matchSignal,
  matchTerminate,
} from "./match/starfrontMatch";
import { rpcUpdateNickname } from "./player/nicknameRpc";
import {
  rpcCleanupRooms,
  rpcCreateRoom,
  rpcJoinRoomByCode,
  rpcListRooms,
  rpcQuickJoin,
} from "./rooms/rpcs";

function InitModule(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
): void {
  initializer.registerMatch(MATCH_MODULE, {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchTerminate,
    matchSignal,
  });

  initializer.registerRpc("create_room", rpcCreateRoom);
  initializer.registerRpc("list_rooms", rpcListRooms);
  initializer.registerRpc("join_room_by_code", rpcJoinRoomByCode);
  initializer.registerRpc("quick_join", rpcQuickJoin);
  initializer.registerRpc("cleanup_rooms", rpcCleanupRooms);
  initializer.registerRpc("update_nickname", rpcUpdateNickname);

  logger.info("StarFront Nakama runtime loaded (module=%s)", MATCH_MODULE);
}

type InitHolder = { InitModule?: typeof InitModule };
(globalThis as InitHolder).InitModule = InitModule;
const cjsExports = (globalThis as { exports?: InitHolder }).exports;
if (cjsExports) {
  cjsExports.InitModule = InitModule;
}
