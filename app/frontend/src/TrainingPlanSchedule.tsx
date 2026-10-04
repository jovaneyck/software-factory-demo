import { Link } from 'react-router-dom';
import { Card } from './ui';
import { DAYS, dayLabel } from './days';

interface Training {
  id: string;
  name: string;
}

interface TrainingPlanScheduleProps {
  schedule: Record<string, string[]>;
  trainings: Training[];
}

function TrainingPlanSchedule({ schedule, trainings }: TrainingPlanScheduleProps) {
  const getTrainingName = (trainingId: string) => {
    const training = trainings.find((t) => t.id === trainingId);
    return training?.name || trainingId;
  };

  return (
    <Card padding="none" className="divide-y divide-line overflow-hidden">
      {DAYS.map((day) => {
        const dayTrainings = schedule[day] ?? [];
        return (
          <div key={day} className="flex items-center gap-4 px-5 py-3.5">
            <span className="w-24 shrink-0 text-sm font-semibold text-ink">{dayLabel(day)}</span>
            <div className="flex min-h-8 flex-1 flex-wrap items-center gap-2">
              {dayTrainings.length === 0 ? (
                <span className="text-sm text-ink-subtle">Rest day</span>
              ) : (
                dayTrainings.map((trainingId) => (
                  <Link
                    key={trainingId}
                    to={`/trainings/${trainingId}`}
                    className="inline-flex h-8 items-center rounded-full bg-brand-50 px-3 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
                  >
                    {getTrainingName(trainingId)}
                  </Link>
                ))
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

export default TrainingPlanSchedule;
