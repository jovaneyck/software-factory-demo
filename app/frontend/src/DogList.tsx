import { useState, useEffect } from 'react';
import { Dog as DogIcon, Plus } from 'lucide-react';
import DogTile from './DogTile';
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  IconButtonLink,
  ListGroup,
  LoadingState,
  PageHeader,
} from './ui';

interface Dog {
  id: string;
  name: string;
  picture: string;
}

function DogList() {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/dogs')
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json();
      })
      .then((data) => {
        setDogs(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState />;

  if (dogs.length === 0) {
    return (
      <EmptyState
        icon={<DogIcon />}
        title="No dogs registered yet."
        description="Add your first pup to start planning training sessions."
        action={
          <ButtonLink to="/dogs/new" icon={<Plus />}>
            Register a dog
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your Dogs"
        description={`${dogs.length} ${dogs.length === 1 ? 'pup' : 'pups'} in training`}
        actions={<IconButtonLink to="/dogs/new" label="Register a dog" icon={<Plus />} />}
      />
      <ListGroup>
        {dogs.map((dog) => (
          <DogTile key={dog.id} dog={dog} to={`/dogs/${dog.id}`} />
        ))}
      </ListGroup>
    </div>
  );
}

export default DogList;
