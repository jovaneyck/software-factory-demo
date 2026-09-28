import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SurpriseTrainingModal from './SurpriseTrainingModal';

const DOG_ID = 'dog-1';

describe('SurpriseTrainingModal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows the surprise training and registers it ad hoc', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSaved = vi.fn();
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((url, options) => {
      const urlStr = String(url);
      if (urlStr === `/api/dogs/${DOG_ID}/trainings/surprise`) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 't1', name: 'Recall' }),
        } as Response);
      }
      if (urlStr === `/api/dogs/${DOG_ID}/sessions` && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 's1' }) } as Response);
      }
      return Promise.reject(new Error(`Unknown URL: ${urlStr}`));
    });

    render(<SurpriseTrainingModal dogId={DOG_ID} onClose={onClose} onSaved={onSaved} />);

    await waitFor(() => {
      expect(screen.getByText('Recall')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    const postCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        String(url) === `/api/dogs/${DOG_ID}/sessions` && options?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(String(postCall![1]!.body));
    expect(body.trainingId).toBe('t1');
    expect(body.status).toBe('completed');
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('shows an empty state when there are no trainings', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'No trainings available' }),
    } as Response);

    render(<SurpriseTrainingModal dogId={DOG_ID} onClose={vi.fn()} onSaved={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/no trainings yet/i)).toBeInTheDocument();
    });
  });
});
