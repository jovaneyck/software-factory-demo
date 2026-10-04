import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ScheduleEditor from './ScheduleEditor';
import type { DayOfWeek } from './days';
import { Button, Card, Field, Input, LoadingState, PageHeader, Section } from './ui';

interface Training {
  id: string;
  name: string;
}

function PlanEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState<Record<DayOfWeek, string[]>>({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  });
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/plans/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setName(data.name);
        setSchedule(data.schedule);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch('/api/trainings')
      .then((res) => res.json())
      .then((data) => setTrainings(data))
      .catch(() => {});
  }, [id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, schedule }),
      });
      if (response.ok) {
        navigate(`/plans/${id}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTraining = (day: DayOfWeek, trainingId: string) => {
    setSchedule((prev) => {
      const dayTrainings = prev[day];
      if (dayTrainings.includes(trainingId)) {
        return { ...prev, [day]: dayTrainings.filter((tid) => tid !== trainingId) };
      } else {
        return { ...prev, [day]: [...dayTrainings, trainingId] };
      }
    });
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Plan" back={{ to: `/plans/${id}`, label: 'Back to plan' }} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card padding="lg">
          <Field label="Name" htmlFor="name">
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
        </Card>

        <Section title="Weekly schedule">
          <Card padding="lg">
            <ScheduleEditor schedule={schedule} trainings={trainings} onToggle={toggleTraining} />
          </Card>
        </Section>

        <Button type="submit" size="lg" block loading={submitting}>
          {submitting ? 'Saving...' : 'Save Plan'}
        </Button>
      </form>
    </div>
  );
}

export default PlanEdit;
