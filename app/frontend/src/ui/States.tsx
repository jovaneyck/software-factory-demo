import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from './cn';
import { Spinner } from './Spinner';

interface EmptyStateProps {
  /** A lucide-react icon element. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Primary call to action, usually a `ButtonLink`. */
  action?: ReactNode;
  className?: string;
}

/** Centered placeholder for "nothing here yet" and error screens. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex animate-rise-in flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 [&>svg]:size-7">
          {icon}
        </span>
      )}
      <div className="max-w-xs space-y-1">
        <p className="text-lg font-semibold text-ink">{title}</p>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  message = 'Something went wrong. Please try again later.',
}: {
  message?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex animate-rise-in flex-col items-center justify-center gap-3 rounded-3xl bg-danger-soft px-6 py-14 text-center"
    >
      <AlertTriangle aria-hidden="true" className="size-7 text-danger" />
      <p className="font-medium text-danger">{message}</p>
    </div>
  );
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex animate-fade-in items-center justify-center gap-3 py-16 text-ink-subtle"
    >
      <Spinner />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
