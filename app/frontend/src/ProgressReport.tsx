import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Target, TrendingUp } from 'lucide-react';
import ProgressGraph from './ProgressGraph';
import DogTile from './DogTile';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListGroup,
  ListItem,
  ListItemIcon,
  PageHeader,
  Section,
  SegmentedControl,
} from './ui';

type TimeRange = 'all' | 'year' | 'month' | 'week';

const TIME_RANGE_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: 'All', value: 'all' },
  { label: 'Year', value: 'year' },
  { label: 'Month', value: 'month' },
  { label: 'Week', value: 'week' },
];

function getCutoffDate(range: TimeRange): string | null {
  if (range === 'all') return null;
  const now = new Date();
  const days = range === 'year' ? 365 : range === 'month' ? 30 : 7;
  now.setDate(now.getDate() - days);
  return now.toISOString().slice(0, 10);
}

interface Dog {
  id: string;
  name: string;
  picture: string;
  planId?: string;
}

interface Training {
  id: string;
  name: string;
}

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

interface DogData {
  dogId: string;
  sessions: Session[];
  trainings: Training[];
}

function ProgressReport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDogId = searchParams.get('dog');
  const selectedTrainingId = searchParams.get('training');

  const [dogs, setDogs] = useState<Dog[]>([]);
  const [error, setError] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [dogData, setDogData] = useState<DogData | null>(null);

  useEffect(() => {
    fetch('/api/dogs')
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json();
      })
      .then(setDogs)
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (!selectedDogId) return;

    let cancelled = false;
    Promise.all([
      fetch(`/api/dogs/${selectedDogId}/sessions?from=2000-01-01&to=2099-12-31`).then((r) =>
        r.json(),
      ),
      fetch('/api/trainings').then((r) => r.json()),
    ]).then(([fetchedSessions, fetchedTrainings]) => {
      if (!cancelled) {
        setDogData({
          dogId: selectedDogId,
          sessions: fetchedSessions,
          trainings: fetchedTrainings,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDogId]);

  // Ignore data still belonging to a previously selected dog
  const loadedData = dogData?.dogId === selectedDogId ? dogData : null;
  const sessions = loadedData?.sessions ?? [];
  const trainings = loadedData?.trainings ?? [];

  const selectedDog = dogs.find((d) => d.id === selectedDogId);

  const relevantSessions = sessions.filter(
    (s) => s.status === 'completed' || s.status === 'skipped',
  );
  const relevantTrainingIds = [...new Set(relevantSessions.map((s) => s.trainingId))];
  const relevantTrainings = trainings.filter((t) => relevantTrainingIds.includes(t.id));

  const selectedTraining = trainings.find((t) => t.id === selectedTrainingId);

  function selectDog(dogId: string) {
    setSearchParams({ dog: dogId });
  }

  function deselectDog() {
    setSearchParams({});
    setTimeRange('all');
  }

  function selectTraining(trainingId: string) {
    setSearchParams({ dog: selectedDogId!, training: trainingId });
  }

  function deselectTraining() {
    setSearchParams({ dog: selectedDogId! });
    setTimeRange('all');
  }

  const header = <PageHeader title="Progress" description="Scores over time, per training" />;

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState />
      </div>
    );
  }

  if (!selectedDog) {
    return (
      <div className="space-y-6">
        {header}
        <Section title="Choose a dog">
          {dogs.length > 0 && (
            <ListGroup>
              {dogs.map((dog) => (
                <DogTile key={dog.id} dog={dog} onClick={() => selectDog(dog.id)} />
              ))}
            </ListGroup>
          )}
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <Card padding="sm" className="flex items-center gap-3">
        <Avatar
          name={selectedDog.name}
          src={selectedDog.picture ? `/uploads/dogs/${selectedDog.picture}` : undefined}
          size="sm"
        />
        <p className="min-w-0 flex-1 truncate font-semibold text-ink">{selectedDog.name}</p>
        <Button variant="ghost" size="sm" onClick={deselectDog}>
          Change dog
        </Button>
      </Card>

      {selectedTraining ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ListItemIcon>
                <TrendingUp />
              </ListItemIcon>
              <p className="font-semibold text-ink">{selectedTraining.name}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={deselectTraining}>
              Change training
            </Button>
          </div>
          <SegmentedControl
            label="Time range"
            options={TIME_RANGE_OPTIONS}
            value={timeRange}
            onChange={setTimeRange}
          />
          <ProgressGraph
            sessions={sessions
              .filter((s) => {
                if (s.trainingId !== selectedTrainingId) return false;
                if (s.status !== 'completed' && s.status !== 'skipped') return false;
                const cutoff = getCutoffDate(timeRange);
                if (cutoff && s.date < cutoff) return false;
                return true;
              })
              .sort((a, b) => a.date.localeCompare(b.date))}
          />
        </Card>
      ) : (
        <Section title="Choose a training">
          {!loadedData ? null : relevantTrainings.length === 0 ? (
            <EmptyState
              icon={<Target />}
              title="No sessions logged yet"
              description="Check off sessions from the dog's profile to see progress here."
            />
          ) : (
            <ListGroup>
              {relevantTrainings.map((training) => (
                <ListItem
                  key={training.id}
                  onClick={() => selectTraining(training.id)}
                  title={training.name}
                  leading={
                    <ListItemIcon>
                      <Target />
                    </ListItemIcon>
                  }
                />
              ))}
            </ListGroup>
          )}
        </Section>
      )}
    </div>
  );
}

export default ProgressReport;
