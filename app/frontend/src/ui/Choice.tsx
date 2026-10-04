import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn';

interface SegmentedControlProps<T extends string> {
  /** Accessible name for the group. */
  label: string;
  options: { label: ReactNode; value: T }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Mutually exclusive toggle buttons. The active option has `aria-pressed="true"`. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex rounded-xl bg-surface-muted p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-8 rounded-lg px-3.5 text-sm font-semibold transition-all',
              active ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

type ChoiceChipProps = Omit<ComponentProps<'input'>, 'type'> & {
  type: 'checkbox' | 'radio';
  children: ReactNode;
};

/**
 * A checkbox or radio styled as a selectable pill. The native input stays in the DOM
 * (visually hidden) so labels, forms and tests work as usual.
 */
export function ChoiceChip({ type, children, className, ...props }: ChoiceChipProps) {
  return (
    <label
      className={cn(
        'inline-flex h-9 cursor-pointer select-none items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 ring-inset transition-all',
        'bg-surface text-ink-muted ring-line-strong hover:text-ink hover:ring-ink-subtle',
        'has-[:checked]:bg-brand-600 has-[:checked]:text-ink-inverted has-[:checked]:ring-brand-600',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500',
        className,
      )}
    >
      <input type={type} className="sr-only" {...props} />
      {children}
    </label>
  );
}
