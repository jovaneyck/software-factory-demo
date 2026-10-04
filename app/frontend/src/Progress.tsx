import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ProgressView from './ProgressView';
import { LoadingState, PageHeader } from './ui';

interface Training {
  id: string;
  name: string;
}

interface Dog {
  id: string;
  name: string;
  picture: string;
  planId?: string;
}

function Progress() {
  const { id: dogId } = useParams<{ id: string }>();
  const [dog, setDog] = useState<Dog | null>(null);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch(`/api/dogs/${dogId}`), fetch('/api/trainings')]).then(
      async ([dogRes, trainingsRes]) => {
        if (dogRes.ok) setDog(await dogRes.json());
        if (trainingsRes.ok) setTrainings(await trainingsRes.json());
        setLoading(false);
      },
    );
  }, [dogId]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {dog && <PageHeader title={dog.name} back={{ to: `/dogs/${dogId}`, label: 'Profile' }} />}
      <ProgressView dogId={dogId!} trainings={trainings} />
    </div>
  );
}

export default Progress;
