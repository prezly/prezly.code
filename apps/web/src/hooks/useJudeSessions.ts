import { useSyncExternalStore } from "react";

import {
  getCreatedJudeSessionIdsSnapshot,
  getJudeSessionsSnapshot,
  subscribeToCreatedJudeSessionIds,
  subscribeToJudeSessions,
  type JudeSession,
} from "../connection/jude";

const EMPTY_JUDE_SESSIONS: ReadonlyArray<JudeSession> = [];
const EMPTY_CREATED_JUDE_SESSION_IDS: ReadonlyArray<string> = [];

export function useJudeSessions(): ReadonlyArray<JudeSession> {
  return useSyncExternalStore(
    subscribeToJudeSessions,
    getJudeSessionsSnapshot,
    () => EMPTY_JUDE_SESSIONS,
  );
}

export function useCreatedJudeSessionIds(): ReadonlyArray<string> {
  return useSyncExternalStore(
    subscribeToCreatedJudeSessionIds,
    getCreatedJudeSessionIdsSnapshot,
    () => EMPTY_CREATED_JUDE_SESSION_IDS,
  );
}
