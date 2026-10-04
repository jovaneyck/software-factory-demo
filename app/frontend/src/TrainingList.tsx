import { useState, useEffect } from 'react';
import { Plus, Target } from 'lucide-react';
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  IconButtonLink,
  ListGroup,
  ListItem,
  ListItemIcon,
  LoadingState,
  PageHeader,
} from './ui';

interface Training {
  id: string;
  name: string;
  procedure: string;
  tips: string;
}

function TrainingList() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/trainings')
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json();
      })
      .then((data) => {
        setTrainings(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState />;

  if (trainings.length === 0) {
    return (
      <EmptyState
        icon={<Target />}
        title="No trainings yet."
        description="Trainings are the exercises you schedule into weekly plans."
        action={
          <ButtonLink to="/trainings/new" icon={<Plus />}>
            Create a training
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trainings"
        description="Exercises you can schedule into a plan"
        actions={<IconButtonLink to="/trainings/new" label="Add training" icon={<Plus />} />}
      />
      <ListGroup>
        {trainings.map((training) => (
          <ListItem
            key={training.id}
            to={`/trainings/${training.id}`}
            title={training.name}
            leading={
              <ListItemIcon>
                <Target />
              </ListItemIcon>
            }
          />
        ))}
      </ListGroup>
    </div>
  );
}

export default TrainingList;
