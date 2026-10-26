/** Keep in sync with shared/protocol.ts. OpCode is client-only. */
export * from "@shared/protocol";

export const OpCode = {
  INPUT: 1,
  SNAPSHOT: 2,
  MATCH_END: 3,
} as const;
