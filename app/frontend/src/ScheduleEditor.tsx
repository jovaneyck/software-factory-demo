import { ChoiceChip } from './ui';
import { DAYS, dayLabel, type DayOfWeek } from './days';

interface Training {
  id: string;
  name: string;
}

interface ScheduleEditorProps {
  schedule: Record<DayOfWeek, string[]>;
  trainings: Training[];
  onToggle: (day: DayOfWeek, trainingId: string) => void;
}

/** Per-day training pickers for creating and editing plans. */
function ScheduleEditor({ schedule, trainings, onToggle }: ScheduleEditorProps) {
  return (
    <div className="divide-y divide-line">
      {DAYS.map((day) => (
        <div
          key={day}
          role="group"
          aria-label={dayLabel(day)}
          className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[7rem_1fr]"
        >
          <span className="text-sm font-semibold text-ink sm:pt-2">{dayLabel(day)}</span>
          <div className="flex flex-wrap gap-2">
            {trainings.map((training) => (
              <ChoiceChip
                key={training.id}
                type="checkbox"
                checked={schedule[day].includes(training.id)}
                onChange={() => onToggle(day, training.id)}
              >
                {training.name}
              </ChoiceChip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ScheduleEditor;
