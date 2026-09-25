import type { DogRepository } from '../dogs/DogRepository.js';
import type { SessionRepository } from './SessionRepository.js';
import type { TrainingRepository } from '../trainings/TrainingRepository.js';

export interface TrainingProgressCsv {
  filename: string;
  content: string;
}

const csvCell = (value: string | number | undefined): string => {
  const text = value === undefined ? '' : String(value);
  const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
};

const filenameForDog = (name: string): string => {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'dog'}-training-progress.csv`;
};

export class TrainingProgressExportService {
  constructor(
    private readonly dogs: DogRepository,
    private readonly trainings: TrainingRepository,
    private readonly sessions: SessionRepository,
  ) {}

  exportForDog(dogId: string): TrainingProgressCsv | null {
    const dog = this.dogs.getById(dogId);
    if (!dog) return null;

    const trainingNames = new Map(
      this.trainings.getAll().map((training) => [training.id, training.name]),
    );
    const sessions = this.sessions
      .getByDogId(dogId)
      .filter((session) => session.status === 'completed' || session.status === 'skipped')
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.trainingId.localeCompare(b.trainingId) ||
          a.id.localeCompare(b.id),
      );

    const rows = [
      ['Date', 'Dog', 'Training', 'Status', 'Score', 'Notes'],
      ...sessions.map((session) => [
        session.date,
        dog.name,
        trainingNames.get(session.trainingId) ?? session.trainingId,
        session.status,
        session.score,
        session.notes,
      ]),
    ];

    return {
      filename: filenameForDog(dog.name),
      content: rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n',
    };
  }
}
