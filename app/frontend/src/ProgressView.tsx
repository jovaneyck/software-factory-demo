import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ChoiceChip,
  Field,
  IconButton,
  Modal,
  Section,
  Textarea,
  cn,
} from './ui';

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

function StatusMarker({ status }: { status: Session['status'] }) {
  if (status === 'completed') {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-sm font-bold text-success">
        {'\u2713'}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'size-8 shrink-0 rounded-full border-2',
        status === 'skipped' ? 'border-line bg-surface-muted' : 'border-dashed border-brand-300',
      )}
    />
  );
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
    session: Session;
    trainingName: string;
  } | null>(null);
  const [sheetStatus, setSheetStatus] = useState<'completed' | 'skipped'>('completed');
  const [sheetScore, setSheetScore] = useState<number | null>(null);
  const [sheetNotes, setSheetNotes] = useState('');

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
    setSheetStatus(
      session.status === 'planned' ? 'completed' : (session.status as 'completed' | 'skipped'),
    );
    setSheetScore(session.score ?? 5);
    setSheetNotes(session.notes ?? '');
  };

  const handleSave = async () => {
    if (!sheetSession) return;
    const { session } = sheetSession;
    const body: Record<string, unknown> = {
      status: sheetStatus,
    };
    if (sheetStatus === 'completed' && sheetScore != null) {
      body.score = sheetScore;
    }
    if (sheetNotes) body.notes = sheetNotes;

    if (session.id) {
      await fetch(`/api/dogs/${dogId}/sessions/${session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      body.trainingId = session.trainingId;
      body.date = session.date;
      if (session.planId) body.planId = session.planId;
      await fetch(`/api/dogs/${dogId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    setSheetSession(null);
    setExpandedSessionId(null);
    await fetchSessions(weekStart);
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

  const todayStr = formatDate(new Date());
  const selectedDateStr = formatDate(selectedDate);
  const daySessions = sessions.filter((s) => s.date === selectedDateStr);

  const headerMonth = MONTH_NAMES[weekStart.getMonth()];
  const headerYear = weekStart.getFullYear();

  return (
    <div className="space-y-5">
      <Card padding="sm" className="space-y-3">
        <div className="flex items-center justify-between">
          <IconButton
            label="previous week"
            icon={<ChevronLeft />}
            size="sm"
            onClick={() => navigateWeek(-1)}
          />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">
              {headerMonth} {headerYear}
            </span>
            {!isCurrentWeek && (
              <Button variant="ghost" size="sm" onClick={navigateToday} className="h-7 px-2">
                Today
              </Button>
            )}
          </div>
          <IconButton
            label="next week"
            icon={<ChevronRight />}
            size="sm"
            onClick={() => navigateWeek(1)}
          />
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map((day, i) => {
            const dateStr = formatDate(day);
            const isSelected = dateStr === selectedDateStr;
            const isToday = dateStr === todayStr;
            const hasCompletedOrSkipped = sessions.some(
              (s) => s.date === dateStr && (s.status === 'completed' || s.status === 'skipped'),
            );

            return (
              <button
                key={i}
                aria-label={`${DAY_LABELS[i]} ${day.getDate()}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  'flex h-[4.25rem] flex-col items-center justify-center rounded-xl transition-all',
                  isSelected
                    ? 'bg-brand-600 text-ink-inverted shadow-brand'
                    : 'text-ink hover:bg-surface-muted',
                )}
              >
                <span
                  className={cn(
                    'text-[11px] font-medium uppercase tracking-wide',
                    isSelected ? 'text-ink-inverted/80' : 'text-ink-subtle',
                  )}
                >
                  {DAY_LABELS[i]}
                </span>
                <span
                  className={cn(
                    'text-lg font-semibold tabular-nums',
                    isToday && !isSelected && 'text-brand-600',
                  )}
                >
                  {day.getDate()}
                </span>
                <span className="flex h-1.5 items-center">
                  {hasCompletedOrSkipped && (
                    <span
                      className={cn(
                        'session-dot size-1.5 rounded-full',
                        isSelected ? 'bg-ink-inverted' : 'bg-brand-500',
                      )}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Section title={formatAgendaHeader(selectedDate)}>
        {daySessions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-subtle">
            No sessions scheduled
          </p>
        ) : (
          <div className="space-y-2">
            {daySessions.map((session, i) => {
              const isExpandable = session.status === 'completed' || session.status === 'skipped';
              const isExpanded = isExpandable && expandedSessionId === session.id;
              const trainingName = trainingMap.get(session.trainingId) ?? session.trainingId;

              return (
                <Card
                  key={session.id ?? `planned-${i}`}
                  padding="sm"
                  className={cn(
                    'animate-rise-in transition-shadow',
                    isExpandable && 'cursor-pointer hover:shadow-raised',
                  )}
                  onClick={
                    isExpandable
                      ? () => setExpandedSessionId(isExpanded ? null : session.id!)
                      : undefined
                  }
                >
                  <div className="flex items-center gap-3">
                    <StatusMarker status={session.status} />
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate font-semibold',
                        session.status === 'skipped' ? 'text-ink-muted' : 'text-ink',
                      )}
                    >
                      {trainingName}
                    </span>
                    {session.status === 'completed' && !isExpanded && session.score != null && (
                      <Badge tone="success">{session.score}/10</Badge>
                    )}
                    {session.status === 'skipped' && !isExpanded && <Badge>Skipped</Badge>}
                    {session.status === 'planned' && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openSheet(session);
                        }}
                      >
                        Check off
                      </Button>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="mt-4 animate-fade-in space-y-3 border-t border-line pt-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={session.status === 'completed' ? 'success' : 'neutral'}>
                          {session.status === 'completed' ? 'Completed' : 'Skipped'}
                        </Badge>
                        {session.status === 'completed' && session.score != null && (
                          <Badge tone="brand">Score: {session.score}/10</Badge>
                        )}
                      </div>
                      {session.notes && (
                        <p className="rounded-xl bg-surface-muted px-3.5 py-2.5 text-sm text-ink-muted">
                          {session.notes}
                        </p>
                      )}
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil />}
                          onClick={(e) => {
                            e.stopPropagation();
                            openSheet(session);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 />}
                          className="text-danger hover:bg-danger-soft"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(session.id!);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      {sheetSession && (
        <Modal
          open
          onClose={() => setSheetSession(null)}
          title={sheetSession.trainingName}
          description={sheetSession.session.date}
          footer={
            <Button onClick={handleSave} size="lg" block>
              Save
            </Button>
          }
        >
          <Field label="Status">
            <div className="flex gap-2">
              <ChoiceChip
                type="radio"
                name="status"
                value="completed"
                checked={sheetStatus === 'completed'}
                onChange={() => setSheetStatus('completed')}
              >
                Completed
              </ChoiceChip>
              <ChoiceChip
                type="radio"
                name="status"
                value="skipped"
                checked={sheetStatus === 'skipped'}
                onChange={() => setSheetStatus('skipped')}
              >
                Skipped
              </ChoiceChip>
            </div>
          </Field>

          {sheetStatus === 'completed' && (
            <Field label="Score" htmlFor="score-slider">
              <div className="flex items-center gap-4">
                <input
                  id="score-slider"
                  type="range"
                  min={1}
                  max={10}
                  value={sheetScore ?? 5}
                  onChange={(e) => setSheetScore(Number(e.target.value))}
                  className="h-2 flex-1 cursor-pointer accent-brand-600"
                />
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-lg font-bold tabular-nums text-brand-700">
                  {sheetScore ?? 5}
                </span>
              </div>
            </Field>
          )}

          <Field label="Notes" htmlFor="session-notes">
            <Textarea
              id="session-notes"
              value={sheetNotes}
              onChange={(e) => setSheetNotes(e.target.value)}
              rows={3}
              placeholder="How did it go?"
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}

export default ProgressView;
