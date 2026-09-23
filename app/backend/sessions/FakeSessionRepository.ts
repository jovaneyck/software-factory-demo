import type { Session } from '../shared/types.js';
import type { SessionRepository } from './SessionRepository.js';

export class FakeSessionRepository implements SessionRepository {
  private data = new Map<string, Session>();

  getById(id: string): Session | null {
    return this.data.get(id) ?? null;
  }

  getByDogId(dogId: string): Session[] {
    return this.getByDogIdInRange(dogId, new Date('0000-01-01'), new Date('9999-12-31'));
  }

  getByDogIdInRange(dogId: string, from: Date, to: Date): Session[] {
    return [...this.data.values()].filter((s) => {
      if (s.dogId !== dogId) return false;
      const d = new Date(`${s.date}T00:00:00`);
      return d >= from && d <= to;
    });
  }

  save(session: Session): void {
    this.data.set(session.id, { ...session });
  }

  delete(id: string): boolean {
    return this.data.delete(id);
  }
}
