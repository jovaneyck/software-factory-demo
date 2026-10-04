import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from './cn';

interface BackLinkProps {
  to: string;
  children: ReactNode;
  className?: string;
}

export function BackLink({ to, children, className }: BackLinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        '-ml-1.5 inline-flex items-center gap-0.5 rounded-lg py-1 pl-0.5 pr-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink',
        className,
      )}
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  back?: { to: string; label: string };
  /** Right-aligned actions, e.g. an `IconButtonLink` or `ButtonLink`. */
  actions?: ReactNode;
}

/** Top of every page: optional back link, `h1` title, description and actions. */
export function PageHeader({ title, description, back, actions }: PageHeaderProps) {
  return (
    <header className="space-y-3">
      {back && <BackLink to={back.to}>{back.label}</BackLink>}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          {description && <p className="text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
