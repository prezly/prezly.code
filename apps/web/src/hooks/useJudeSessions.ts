import { useSyncExternalStore } from "react";

import {
  getJudeSessionsSnapshot,
  subscribeToJudeSessions,
  type JudeSession,
} from "../connection/jude";

const EMPTY_JUDE_SESSIONS: ReadonlyArray<JudeSession> = [];

export function useJudeSessions(): ReadonlyArray<JudeSession> {
  return useSyncExternalStore(
    subscribeToJudeSessions,
    getJudeSessionsSnapshot,
    () => EMPTY_JUDE_SESSIONS,
  );
}
