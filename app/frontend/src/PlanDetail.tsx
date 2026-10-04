import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, SearchX } from 'lucide-react';
import TrainingPlanSchedule from './TrainingPlanSchedule';
import { BackLink, ButtonLink, EmptyState, LoadingState, PageHeader } from './ui';

interface Training {
  id: string;
  name: string;
}

interface Plan {
  id: string;
  name: string;
  schedule: Record<string, string[]>;
}

function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/plans/${id}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setPlan(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch('/api/trainings')
      .then((res) => res.json())
      .then((data) => setTrainings(data))
      .catch(() => {});
  }, [id]);

  if (loading) return <LoadingState />;

  if (notFound) {
    return (
      <EmptyState
        icon={<SearchX />}
        title="Plan not found."
        action={<BackLink to="/plans">Back to plans</BackLink>}
      />
    );
  }

  if (!plan) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={plan.name}
        description="Weekly schedule"
        back={{ to: '/plans', label: 'Back to plans' }}
        actions={
          <ButtonLink to={`/plans/${plan.id}/edit`} variant="secondary" icon={<Pencil />}>
            Edit
          </ButtonLink>
        }
      />
      <TrainingPlanSchedule schedule={plan.schedule} trainings={trainings} />
    </div>
  );
}

export default PlanDetail;
