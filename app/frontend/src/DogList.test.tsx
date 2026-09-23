import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DogList from './DogList';

describe('DogList', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows empty state when no dogs exist', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response);

    render(
      <BrowserRouter>
        <DogList />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no dogs registered/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/register a dog/i)).toBeInTheDocument();
  });

  it('displays list of dogs', async () => {
    const dogs = [
      { id: '1', name: 'Buddy', picture: 'buddy.jpg' },
      { id: '2', name: 'Max', picture: 'max.jpg' },
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(dogs),
    } as Response);

    render(
      <BrowserRouter>
        <DogList />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Buddy')).toBeInTheDocument();
      expect(screen.getByText('Max')).toBeInTheDocument();
    });
  });

  it('renders a Surprise me link for each dog', async () => {
    const dogs = [
      { id: '1', name: 'Buddy', picture: 'buddy.jpg' },
      { id: '2', name: 'Max', picture: 'max.jpg' },
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(dogs),
    } as Response);

    render(
      <BrowserRouter>
        <DogList />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Buddy')).toBeInTheDocument();
    });

    const buddySurprise = screen.getByRole('link', { name: /surprise me for Buddy/i });
    expect(buddySurprise).toHaveAttribute('href', '/dogs/1?surprise=1');
    const maxSurprise = screen.getByRole('link', { name: /surprise me for Max/i });
    expect(maxSurprise).toHaveAttribute('href', '/dogs/2?surprise=1');
  });

  it('shows profile picture badges for dogs with pictures', async () => {
    const dogs = [
      { id: '1', name: 'Buddy', picture: 'buddy.jpg' },
      { id: '2', name: 'Max', picture: 'max.jpg' },
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(dogs),
    } as Response);

    render(
      <BrowserRouter>
        <DogList />
      </BrowserRouter>,
    );

    await waitFor(() => {
      const buddyImg = screen.getByAltText('Buddy');
      expect(buddyImg).toBeInTheDocument();
      expect(buddyImg).toHaveAttribute('src', '/uploads/dogs/buddy.jpg');

      const maxImg = screen.getByAltText('Max');
      expect(maxImg).toBeInTheDocument();
      expect(maxImg).toHaveAttribute('src', '/uploads/dogs/max.jpg');
    });
  });

  it('does not render image for dogs without a picture', async () => {
    const dogs = [
      { id: '1', name: 'Buddy', picture: '' },
      { id: '2', name: 'Max' },
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(dogs),
    } as Response);

    render(
      <BrowserRouter>
        <DogList />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Buddy')).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows error message when fetch returns non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal Server Error' }),
    } as Response);

    render(
      <BrowserRouter>
        <DogList />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/no dogs registered/i)).not.toBeInTheDocument();
  });

  it('shows error message when fetch rejects with network error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    render(
      <BrowserRouter>
        <DogList />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/no dogs registered/i)).not.toBeInTheDocument();
  });

  it('still shows the dog list when the trainings fetch fails', async () => {
    const dogs = [{ id: '1', name: 'Buddy', picture: 'buddy.jpg' }];
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (String(url) === '/api/dogs') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(dogs) } as Response);
      }
      if (String(url) === '/api/trainings') {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    render(
      <BrowserRouter>
        <DogList />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Buddy')).toBeInTheDocument();
    });

    // Trainings are unavailable, so the optional action is hidden...
    expect(screen.queryByRole('link', { name: /surprise me/i })).not.toBeInTheDocument();
    // ...but the failed trainings request must not blank the whole page.
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
