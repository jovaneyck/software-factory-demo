import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn';

type Padding = 'none' | 'sm' | 'md' | 'lg';

const paddings: Record<Padding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export type CardProps = ComponentProps<'div'> & { padding?: Padding };

/** White rounded surface. The default container for any grouped content. */
export function Card({ padding = 'md', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-surface shadow-card ring-1 ring-line/60',
        paddings[padding],
        className,
      )}
      {...props}
    />
  );
}

interface SectionProps {
  title: ReactNode;
  /** Right-aligned element next to the title, e.g. a small Button. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A titled block of page content. Titles render as `h2`. */
export function Section({ title, action, children, className }: SectionProps) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
