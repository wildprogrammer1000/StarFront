/** Match data op-codes shared with the client. */
export const OpCode = {
  /** Client → server: PlayerInput JSON */
  INPUT: 1,
  /** Server → client: MatchSnapshot JSON */
  SNAPSHOT: 2,
  /** Server → client: match ended payload */
  MATCH_END: 3,
} as const;
