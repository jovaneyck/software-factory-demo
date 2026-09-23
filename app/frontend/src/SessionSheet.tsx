import { useState } from 'react';
import ModalShell from './ModalShell';

export interface SessionSheetSession {
  id?: string;
  dogId: string;
  trainingId: string;
  planId?: string;
  date: string;
  status: 'planned' | 'completed' | 'skipped';
  score?: number;
  notes?: string;
}

interface SessionSheetProps {
  readonly dogId: string;
  readonly trainingName: string;
  readonly session: SessionSheetSession;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

/**
 * The registration sheet used to check off a session. Reused by the weekly
 * progress view and by the "Surprise me" flow so ad-hoc registrations behave
 * exactly like normal ones.
 */
function SessionSheet({ dogId, trainingName, session, onClose, onSaved }: SessionSheetProps) {
  const [status, setStatus] = useState<'completed' | 'skipped'>(
    session.status === 'planned' ? 'completed' : session.status,
  );
  const [score, setScore] = useState<number | null>(session.score ?? 5);
  const [notes, setNotes] = useState(session.notes ?? '');

  const handleSave = async () => {
    const body: Record<string, unknown> = { status };
    if (status === 'completed' && score != null) {
      body.score = score;
    }
    if (notes) body.notes = notes;

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
    onSaved();
  };

  return (
    <ModalShell onClose={onClose} contentClassName="space-y-4 max-h-[90vh] overflow-y-auto">
      <h3 className="text-lg font-semibold text-slate-800">{trainingName}</h3>
      <p className="text-sm text-slate-500">{session.date}</p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Status</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="status"
              value="completed"
              checked={status === 'completed'}
              onChange={() => setStatus('completed')}
            />
            <span>Completed</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="status"
              value="skipped"
              checked={status === 'skipped'}
              onChange={() => setStatus('skipped')}
            />
            <span>Skipped</span>
          </label>
        </div>
      </fieldset>

      {status === 'completed' && (
        <div className="space-y-2">
          <label htmlFor="score-slider" className="text-sm font-medium text-slate-700">
            Score
          </label>
          <div className="flex items-center gap-3">
            <input
              id="score-slider"
              type="range"
              min={1}
              max={10}
              value={score ?? 5}
              onChange={(e) => setScore(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-lg font-semibold text-slate-800 w-6 text-center">
              {score ?? 5}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="session-notes" className="text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="session-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          rows={3}
        />
      </div>

      <button
        onClick={handleSave}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700"
      >
        Save
      </button>
    </ModalShell>
  );
}

export default SessionSheet;
