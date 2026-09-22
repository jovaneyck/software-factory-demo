import Papa from 'papaparse';
import type { Dog, Session, Training } from '../shared/types.js';

export function sessionCsv(dog: Dog, sessions: Session[], trainings: Training[]): string {
  const trainingNames = new Map(trainings.map((training) => [training.id, training.name]));
  const data = sessions
    .filter((session) => session.status === 'completed' || session.status === 'skipped')
    .sort(
      (first, second) => first.date.localeCompare(second.date) || first.id.localeCompare(second.id),
    )
    .map((session) => [
      session.date,
      dog.name,
      dog.id,
      trainingNames.get(session.trainingId) ?? '',
      session.trainingId,
      session.planId ?? '',
      session.id,
      session.status,
      session.score ?? '',
      session.notes ?? '',
    ]);

  return (
    '\uFEFF' +
    Papa.unparse(
      {
        fields: [
          'date',
          'dogName',
          'dogId',
          'trainingName',
          'trainingId',
          'planId',
          'sessionId',
          'status',
          'score',
          'notes',
        ],
        data,
      },
      { newline: '\r\n', escapeFormulae: /^[\s]*[=+\-@\t\r]/ },
    ) +
    (data.length ? '\r\n' : '')
  );
}
