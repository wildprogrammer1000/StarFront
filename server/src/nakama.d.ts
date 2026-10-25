/** Minimal Nakama JS runtime typings used by this project. */
declare namespace nkruntime {
  interface Context {
    userId: string;
    username: string;
    vars: { [key: string]: string };
  }

  interface Logger {
    info(format: string, ...args: unknown[]): void;
    warn(format: string, ...args: unknown[]): void;
    error(format: string, ...args: unknown[]): void;
    debug(format: string, ...args: unknown[]): void;
  }

  interface StorageWriteRequest {
    collection: string;
    key: string;
    userId: string;
    value: object;
    version?: string;
    permissionRead?: number;
    permissionWrite?: number;
  }

  interface StorageReadRequest {
    collection: string;
    key: string;
    userId: string;
  }

  interface StorageDeleteRequest {
    collection: string;
    key: string;
    userId: string;
  }

  interface StorageObject {
    collection: string;
    key: string;
    userId: string;
    value: object;
    version: string;
  }

  interface StorageList {
    objects: StorageObject[];
    cursor?: string;
  }

  interface Match {
    matchId: string;
    authoritative: boolean;
    label: string;
    size: number;
    tickRate: number;
    handlerName: string;
  }

  interface User {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    langTag?: string;
    location?: string;
    timezone?: string;
    lang_tag?: string;
    avatar_url?: string;
  }

  interface Nakama {
    matchCreate(module: string, params?: { [key: string]: unknown }): string;
    usersGetId(userIds: string[]): User[];
    matchGet(id: string): Match | null;
    binaryToString(data: ArrayBuffer | Uint8Array | string): string;
    stringToBinary(str: string): ArrayBuffer;
    storageWrite(objects: StorageWriteRequest[]): StorageObject[];
    storageRead(keys: StorageReadRequest[]): StorageObject[];
    storageDelete(keys: StorageDeleteRequest[]): void;
    storageList(
      userId: string,
      collection: string,
      limit: number,
      cursor?: string
    ): StorageList;
    /** 빈 문자열 필드는 기존 값을 유지한다. metadata 가 null 이면 메타데이터도 유지. */
    accountUpdateId(
      userId: string,
      username: string,
      displayName: string,
      timezone: string,
      location: string,
      langTag: string,
      avatarUrl: string,
      metadata: { [key: string]: unknown } | null
    ): void;
    sqlQuery(
      query: string,
      args: unknown[]
    ): { [key: string]: unknown }[];
  }

  interface MatchDispatcher {
    broadcastMessage(
      opCode: number,
      data: string | ArrayBuffer | null,
      presets?: Presence[] | null,
      sender?: Presence | null,
      reliable?: boolean
    ): void;
  }

  interface Presence {
    userId: string;
    sessionId: string;
    username: string;
    node: string;
  }

  interface MatchData {
    opCode: number;
    data: ArrayBuffer;
    presence: Presence;
    reliable: boolean;
  }

  type MatchHandler = {
    matchInit: (
      ctx: Context,
      logger: Logger,
      nk: Nakama,
      params: { [key: string]: string }
    ) => { state: unknown; tickRate: number; label: string };
    matchJoinAttempt: (
      ctx: Context,
      logger: Logger,
      nk: Nakama,
      dispatcher: MatchDispatcher,
      tick: number,
      state: unknown,
      presence: Presence,
      metadata: { [key: string]: unknown }
    ) => { state: unknown; accept: boolean; rejectMessage?: string };
    matchJoin: (
      ctx: Context,
      logger: Logger,
      nk: Nakama,
      dispatcher: MatchDispatcher,
      tick: number,
      state: unknown,
      presences: Presence[]
    ) => { state: unknown } | null;
    matchLeave: (
      ctx: Context,
      logger: Logger,
      nk: Nakama,
      dispatcher: MatchDispatcher,
      tick: number,
      state: unknown,
      presences: Presence[]
    ) => { state: unknown } | null;
    matchLoop: (
      ctx: Context,
      logger: Logger,
      nk: Nakama,
      dispatcher: MatchDispatcher,
      tick: number,
      state: unknown,
      messages: MatchData[]
    ) => { state: unknown } | null;
    matchTerminate: (
      ctx: Context,
      logger: Logger,
      nk: Nakama,
      dispatcher: MatchDispatcher,
      tick: number,
      state: unknown,
      graceSeconds: number
    ) => { state: unknown } | null;
    matchSignal: (
      ctx: Context,
      logger: Logger,
      nk: Nakama,
      dispatcher: MatchDispatcher,
      tick: number,
      state: unknown,
      data: string
    ) => { state: unknown; data?: string } | null;
  };

  type RpcFunction = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    payload: string
  ) => string;

  interface Initializer {
    registerMatch(name: string, handlers: MatchHandler): void;
    registerMatchmakerMatched(
      fn: (
        ctx: Context,
        logger: Logger,
        nk: Nakama,
        matches: MatchmakerEntry[]
      ) => string | void
    ): void;
    registerRpc(id: string, fn: RpcFunction): void;
  }

  interface MatchmakerEntry {
    presence: Presence;
    properties: { [key: string]: string };
    partyId?: string;
  }
}

declare function InitModule(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
): void;
