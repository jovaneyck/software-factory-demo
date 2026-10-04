export type Dog = { id: string; name: string; picture: string; planId?: string };
export type Training = { id: string; name: string; procedure: string; tips: string };
export type Plan = { id: string; name: string; schedule: Record<string, string[]> };
export type Session = {
  id: string;
  dogId: string;
  trainingId: string;
  date: string;
  status: string;
  planId?: string;
  score?: number;
  notes?: string;
};

/** A schedule-derived session that has not been persisted yet (no id). */
export type PlannedSession = Omit<Session, 'id' | 'status'> & { id?: string; status: 'planned' };

/** A session as returned by the listing service: persisted or schedule-derived. */
export type ListedSession = Session | PlannedSession;
