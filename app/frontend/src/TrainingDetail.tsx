import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Lightbulb, ListOrdered, Pencil, SearchX } from 'lucide-react';
import { BackLink, ButtonLink, Card, EmptyState, LoadingState, PageHeader } from './ui';
import { Markdown } from './ui/Markdown';

interface Training {
  id: string;
  name: string;
  procedure: string;
  tips: string;
}

function TrainingDetail() {
  const { id } = useParams<{ id: string }>();
  const [training, setTraining] = useState<Training | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/trainings/${id}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setTraining(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingState />;

  if (notFound) {
    return (
      <EmptyState
        icon={<SearchX />}
        title="Training not found."
        action={<BackLink to="/trainings">Back to trainings</BackLink>}
      />
    );
  }

  if (!training) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={training.name}
        back={{ to: '/trainings', label: 'Back' }}
        actions={
          <ButtonLink to={`/trainings/${training.id}/edit`} variant="secondary" icon={<Pencil />}>
            Edit
          </ButtonLink>
        }
      />
      <Card padding="lg" className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <ListOrdered aria-hidden="true" className="size-5 text-brand-600" />
          Procedure
        </h2>
        <Markdown source={training.procedure} />
      </Card>
      <Card padding="lg" className="space-y-3 bg-warning-soft/60 ring-warning/10">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Lightbulb aria-hidden="true" className="size-5 text-warning" />
          Tips
        </h2>
        <Markdown source={training.tips} />
      </Card>
    </div>
  );
}

export default TrainingDetail;
