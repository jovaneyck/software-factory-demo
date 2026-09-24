import { useState, useEffect, useCallback } from 'react';
import SessionSheet, { type SessionSheetSession } from './SessionSheet';

interface Session {
  id?: string;
  dogId: string;
  trainingId: string;
  planId?: string;
  date: string;
  status: 'planned' | 'completed' | 'skipped';
  score?: number;
  notes?: string;
}

interface Training {
  id: string;
  name: string;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatAgendaHeader(date: Date): string {
  const dayName = DAY_LABELS[date.getDay() === 0 ? 6 : date.getDay() - 1];
  const dayNum = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName} ${dayNum} ${month} ${year}`;
}

interface ProgressViewProps {
  dogId: string;
  trainings: Training[];
}

function ProgressView({ dogId, trainings }: ProgressViewProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sheetSession, setSheetSession] = useState<{
    session: SessionSheetSession;
    trainingName: string;
  } | null>(null);

  const weekDays = getWeekDays(weekStart);

  const loadWeek = useCallback(
    async (monday: Date): Promise<Session[] | null> => {
      const from = formatDate(monday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const to = formatDate(sunday);
      const res = await fetch(`/api/dogs/${dogId}/sessions?from=${from}&to=${to}`);
      return res.ok ? await res.json() : null;
    },
    [dogId],
  );

  const fetchSessions = useCallback(
    async (monday: Date) => {
      const week = await loadWeek(monday);
      if (week) setSessions(week);
    },
    [loadWeek],
  );

  useEffect(() => {
    let cancelled = false;
    loadWeek(weekStart).then((week) => {
      if (!cancelled && week) setSessions(week);
    });
    return () => {
      cancelled = true;
    };
  }, [weekStart, loadWeek]);

  const handleRemove = async (sessionId: string) => {
    const res = await fetch(`/api/dogs/${dogId}/sessions/${sessionId}`, { method: 'DELETE' });
    if (res.ok) {
      setExpandedSessionId(null);
      await fetchSessions(weekStart);
    }
  };

  const trainingMap = new Map(trainings.map((t) => [t.id, t.name]));

  const openSheet = (session: Session) => {
    const trainingName = trainingMap.get(session.trainingId) ?? session.trainingId;
    setSheetSession({ session, trainingName });
  };

  const navigateWeek = (direction: number) => {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + direction * 7);
      return next;
    });
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + direction * 7);
      return next;
    });
  };

  const navigateToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setWeekStart(getMonday(today));
  };

  const isCurrentWeek = formatDate(weekStart) === formatDate(getMonday(new Date()));

  const selectedDateStr = formatDate(selectedDate);
  const daySessions = sessions.filter((s) => s.date === selectedDateStr);

  const headerMonth = MONTH_NAMES[weekStart.getMonth()];
  const headerYear = weekStart.getFullYear();

  return (
    <>
      {/* Week strip */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateWeek(-1)}
            aria-label="previous week"
            className="p-2 text-slate-600 hover:text-slate-800"
          >
            &lt;
          </button>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">
              {headerMonth} {headerYear}
            </span>
            {!isCurrentWeek && (
              <button
                onClick={navigateToday}
                className="text-sm text-blue-600 font-medium hover:text-blue-800"
              >
                Today
              </button>
            )}
          </div>
          <button
            onClick={() => navigateWeek(1)}
            aria-label="next week"
            className="p-2 text-slate-600 hover:text-slate-800"
          >
            &gt;
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map((day, i) => {
            const dateStr = formatDate(day);
            const isSelected = dateStr === selectedDateStr;
            const hasCompletedOrSkipped = sessions.some(
              (s) => s.date === dateStr && (s.status === 'completed' || s.status === 'skipped'),
            );

            return (
              <button
                key={i}
                aria-label={`${DAY_LABELS[i]} ${day.getDate()}`}
                onClick={() => setSelectedDate(day)}
                className={`flex flex-col items-center py-2 rounded-xl transition-colors ${
                  isSelected ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="text-xs">{DAY_LABELS[i]}</span>
                <span className="text-lg font-semibold">{day.getDate()}</span>
                {hasCompletedOrSkipped && (
                  <span className="session-dot w-1.5 h-1.5 rounded-full bg-current mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Agenda */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-700">{formatAgendaHeader(selectedDate)}</h3>

        {daySessions.length === 0 ? (
          <p className="text-slate-500">No sessions scheduled</p>
        ) : (
          <div className="space-y-2">
            {daySessions.map((session, i) => {
              const isExpandable = session.status === 'completed' || session.status === 'skipped';
              const isExpanded = isExpandable && expandedSessionId === session.id;
              const trainingName = trainingMap.get(session.trainingId) ?? session.trainingId;

              return (
                <div
                  key={session.id ?? `planned-${i}`}
                  className="bg-white rounded-xl shadow-sm p-4"
                  onClick={
                    isExpandable
                      ? () => setExpandedSessionId(isExpanded ? null : session.id!)
                      : undefined
                  }
                  style={isExpandable ? { cursor: 'pointer' } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{trainingName}</span>
                    <div className="flex items-center gap-2">
                      {session.status === 'completed' && !isExpanded && (
                        <>
                          {session.score != null && (
                            <span className="text-slate-600">{session.score}/10</span>
                          )}
                          <span className="text-green-600 font-bold">{'\u2713'}</span>
                        </>
                      )}
                      {session.status === 'skipped' && !isExpanded && (
                        <span className="text-slate-400 text-sm">Skipped</span>
                      )}
                      {session.status === 'planned' && (
                        <button
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSheet(session);
                          }}
                        >
                          Check off
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t pt-3">
                      <p className="text-sm text-slate-600">
                        {session.status === 'completed' ? 'Completed' : 'Skipped'}
                      </p>
                      {session.status === 'completed' && session.score != null && (
                        <p className="text-sm text-slate-600">Score: {session.score}/10</p>
                      )}
                      {session.notes && <p className="text-sm text-slate-600">{session.notes}</p>}
                      <div className="flex gap-2 pt-1">
                        <button
                          className="text-sm text-blue-600 font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSheet(session);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-sm text-red-600 font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(session.id!);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {sheetSession && (
        <SessionSheet
          dogId={dogId}
          trainingName={sheetSession.trainingName}
          session={sheetSession.session}
          onClose={() => setSheetSession(null)}
          onSaved={async () => {
            setSheetSession(null);
            setExpandedSessionId(null);
            await fetchSessions(weekStart);
          }}
        />
      )}
    </>
  );
}

export default ProgressView;
