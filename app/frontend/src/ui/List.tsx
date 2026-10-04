import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from './cn';

/** Groups `ListItem`s into one card with hairline dividers (iOS-style list). */
export function ListGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/60',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ListItemContentProps {
  title: ReactNode;
  description?: ReactNode;
  /** Leading visual: an `Avatar` or `ListItemIcon`. */
  leading?: ReactNode;
  /** Trailing content shown before the chevron, e.g. a `Badge`. */
  trailing?: ReactNode;
}

type ListItemProps = ListItemContentProps & { className?: string } & (
    { to: string; onClick?: never } | { onClick: () => void; to?: never }
  );

const rowClasses =
  'group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-muted/70 active:bg-surface-muted';

function ListItemContent({ title, description, leading, trailing }: ListItemContentProps) {
  return (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
        {description && (
          <span className="mt-0.5 block truncate text-sm text-ink-muted">{description}</span>
        )}
      </span>
      {trailing}
      <span
        aria-hidden="true"
        className="text-2xl leading-none text-ink-subtle transition-transform group-hover:translate-x-0.5"
      >
        ›
      </span>
    </>
  );
}

/** A navigable row. Pass `to` for a link, or `onClick` for a button. */
export function ListItem({ className, to, onClick, ...content }: ListItemProps) {
  if (to) {
    return (
      <Link to={to} className={cn(rowClasses, className)}>
        <ListItemContent {...content} />
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cn(rowClasses, className)}>
      <ListItemContent {...content} />
    </button>
  );
}

/** Square tinted icon tile used as `ListItem` leading content. */
export function ListItemIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 [&>svg]:size-5">
      {children}
    </span>
  );
}
