import { useEffect, useState } from 'react';
import ModalShell from './ModalShell';
import SessionSheet, { type SessionSheetSession } from './SessionSheet';

interface Training {
  id: string;
  name: string;
}

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface SurpriseTrainingModalProps {
  readonly dogId: string;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

/**
 * Fetches the training the dog has not performed for the longest time and pops
 * up the normal registration sheet for it, so it can be registered ad hoc.
 */
function SurpriseTrainingModal({ dogId, onClose, onSaved }: SurpriseTrainingModalProps) {
  const [training, setTraining] = useState<Training | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dogs/${dogId}/trainings/surprise`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Training | null) => {
        if (cancelled) return;
        if (data) {
          setTraining(data);
          setState('ready');
        } else {
          setState('empty');
        }
      })
      .catch(() => {
        if (!cancelled) setState('empty');
      });
    return () => {
      cancelled = true;
    };
  }, [dogId]);

  if (state === 'loading') {
    return (
      <ModalShell onClose={onClose}>
        <p className="text-slate-500">Finding a training…</p>
      </ModalShell>
    );
  }

  if (state === 'empty' || !training) {
    return (
      <ModalShell onClose={onClose} contentClassName="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800">Surprise training</h3>
        <p className="text-slate-600">No trainings yet. Create one to get started.</p>
        <button
          onClick={onClose}
          className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-200"
        >
          Close
        </button>
      </ModalShell>
    );
  }

  const session: SessionSheetSession = {
    dogId,
    trainingId: training.id,
    date: today(),
    status: 'planned',
  };

  return (
    <SessionSheet
      dogId={dogId}
      trainingName={training.name}
      session={session}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

export default SurpriseTrainingModal;
