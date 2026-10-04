import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, Download, SearchX } from 'lucide-react';
import ProgressView from './ProgressView';
import {
  BackLink,
  Button,
  ButtonLink,
  buttonStyles,
  Card,
  EmptyState,
  ListItemIcon,
  LoadingState,
  Section,
  Select,
} from './ui';

interface Dog {
  id: string;
  name: string;
  picture: string;
  planId?: string;
}

interface Plan {
  id: string;
  name: string;
  schedule: Record<string, string[]>;
}

interface Training {
  id: string;
  name: string;
}

function DogProfile() {
  const { id } = useParams<{ id: string }>();
  const [dog, setDog] = useState<Dog | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [assignedPlan, setAssignedPlan] = useState<Plan | null>(null);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');

  useEffect(() => {
    Promise.all([fetch(`/api/dogs/${id}`), fetch('/api/plans'), fetch('/api/trainings')])
      .then(async ([dogRes, plansRes, trainingsRes]) => {
        if (!dogRes.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const dogData = await dogRes.json();
        const plansData = await plansRes.json();
        const trainingsData = await trainingsRes.json();
        setDog(dogData);
        setPlans(plansData);
        setTrainings(trainingsData);

        if (dogData.planId) {
          const planRes = await fetch(`/api/plans/${dogData.planId}`);
          if (planRes.ok) {
            setAssignedPlan(await planRes.json());
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [id]);

  const handleAssign = async () => {
    if (!selectedPlanId) return;
    const res = await fetch(`/api/dogs/${id}/plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: selectedPlanId }),
    });
    if (res.ok) {
      const updatedDog = await res.json();
      setDog(updatedDog);
      const planRes = await fetch(`/api/plans/${selectedPlanId}`);
      if (planRes.ok) {
        setAssignedPlan(await planRes.json());
      }
      setSelectedPlanId('');
    }
  };

  const handleUnassign = async () => {
    const res = await fetch(`/api/dogs/${id}/plan`, { method: 'DELETE' });
    if (res.ok) {
      const updatedDog = await res.json();
      setDog(updatedDog);
      setAssignedPlan(null);
    }
  };

  if (loading) return <LoadingState />;

  if (notFound) {
    return (
      <div className="space-y-6">
        <BackLink to="/">Dogs</BackLink>
        <EmptyState icon={<SearchX />} title="Dog not found" />
      </div>
    );
  }

  if (!dog) return null;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <BackLink to="/">Dogs</BackLink>
        <div className="relative overflow-hidden rounded-3xl bg-surface-sunken shadow-raised">
          <img
            src={`/uploads/dogs/${dog.picture}`}
            alt={dog.name}
            className="aspect-[4/3] w-full object-cover sm:aspect-[16/9]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/0 to-ink/0" />
          <h1 className="absolute bottom-0 left-0 p-5 text-3xl font-bold tracking-tight text-ink-inverted sm:p-7 sm:text-4xl">
            {dog.name}
          </h1>
        </div>
      </div>

      <Section title="Training plan">
        {assignedPlan ? (
          <Card className="flex flex-wrap items-center gap-4">
            <ListItemIcon>
              <CalendarDays />
            </ListItemIcon>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{assignedPlan.name}</p>
              <p className="text-sm text-ink-muted">Current weekly plan</p>
            </div>
            <div className="flex gap-2">
              <ButtonLink to={`/plans/${assignedPlan.id}`} variant="secondary" size="sm">
                View Plan
              </ButtonLink>
              <Button onClick={handleUnassign} variant="danger" size="sm">
                Unassign
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="space-y-3">
            <p className="text-sm text-ink-muted">
              Pick a weekly plan to start scheduling sessions.
            </p>
            <div className="flex items-center gap-2">
              <Select
                aria-label="Training plan"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="flex-1"
              >
                <option value="">Select a plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </Select>
              <Button onClick={handleAssign} disabled={!selectedPlanId} className="h-11">
                Assign
              </Button>
            </div>
          </Card>
        )}
      </Section>

      {assignedPlan && (
        <Section
          title="Sessions"
          action={
            <a
              href={`/api/dogs/${id}/sessions/export.csv`}
              download
              className={buttonStyles({ variant: 'secondary', size: 'sm' })}
            >
              <Download />
              Export CSV
            </a>
          }
        >
          <ProgressView dogId={id!} trainings={trainings} />
        </Section>
      )}
    </div>
  );
}

export default DogProfile;
