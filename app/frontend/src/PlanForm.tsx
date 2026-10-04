import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import ScheduleEditor from './ScheduleEditor';
import type { DayOfWeek } from './days';
import { Button, Card, Field, Input, PageHeader, Section } from './ui';

interface Training {
  id: string;
  name: string;
}

function PlanForm() {
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/trainings')
      .then((res) => res.json())
      .then((data) => setTrainings(data))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, schedule }),
      });
      if (response.ok) {
        navigate('/plans');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTraining = (day: DayOfWeek, trainingId: string) => {
    setSchedule((prev) => {
      const dayTrainings = prev[day];
      if (dayTrainings.includes(trainingId)) {
        return { ...prev, [day]: dayTrainings.filter((id) => id !== trainingId) };
      } else {
        return { ...prev, [day]: [...dayTrainings, trainingId] };
      }
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Create Plan" back={{ to: '/plans', label: 'Back to plans' }} />

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

export default PlanForm;
