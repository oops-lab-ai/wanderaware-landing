import { createContext, useContext } from "react";

import type { SessionData } from "@/lib/amplify/types";

const SessionContext = createContext<SessionData | null>(null);

export function SessionProvider({ value, children }: { value: SessionData; children: React.ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext(): SessionData {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessionContext must be used within an AuthGuard");
  return ctx;
}
