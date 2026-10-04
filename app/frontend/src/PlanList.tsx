import { useState, useEffect } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
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

interface Plan {
  id: string;
  name: string;
  schedule: Record<string, string[]>;
}

function summarize(schedule: Record<string, string[]>) {
  const days = Object.values(schedule).filter((ids) => ids.length > 0);
  const sessions = days.reduce((total, ids) => total + ids.length, 0);
  return `${sessions} ${sessions === 1 ? 'session' : 'sessions'} · ${days.length} ${days.length === 1 ? 'day' : 'days'} a week`;
}

function PlanList() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/plans')
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json();
      })
      .then((data) => {
        setPlans(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState />;

  if (plans.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="No plans yet."
        description="A plan maps trainings onto the days of the week."
        action={
          <ButtonLink to="/plans/new" icon={<Plus />}>
            Create a plan
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training Plans"
        description="Weekly routines you can assign to a dog"
        actions={<IconButtonLink to="/plans/new" label="Add plan" icon={<Plus />} />}
      />
      <ListGroup>
        {plans.map((plan) => (
          <ListItem
            key={plan.id}
            to={`/plans/${plan.id}`}
            title={plan.name}
            description={plan.schedule ? summarize(plan.schedule) : undefined}
            leading={
              <ListItemIcon>
                <CalendarDays />
              </ListItemIcon>
            }
          />
        ))}
      </ListGroup>
    </div>
  );
}

export default PlanList;
