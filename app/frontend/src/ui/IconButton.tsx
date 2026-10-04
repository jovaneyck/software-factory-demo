import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from './cn';
import type { ButtonVariant } from './buttonStyles';

type IconButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-ink-inverted shadow-brand hover:bg-brand-700',
  secondary:
    'bg-surface text-ink-muted ring-1 ring-inset ring-line hover:text-ink hover:bg-surface-muted',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-muted',
  danger: 'text-danger hover:bg-danger-soft',
};

const sizes: Record<IconButtonSize, string> = {
  sm: 'size-8 rounded-lg [&>svg]:size-4',
  md: 'size-10 rounded-xl [&>svg]:size-5',
  lg: 'size-12 rounded-2xl [&>svg]:size-6',
};

interface IconButtonOwnProps {
  /** Accessible name — required because the button has no visible text. */
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: IconButtonSize;
}

function iconButtonStyles(variant: ButtonVariant, size: IconButtonSize, className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center transition-all duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  );
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...props
}: Omit<ComponentProps<'button'>, 'children'> & IconButtonOwnProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={iconButtonStyles(variant, size, className)}
      {...props}
    >
      {icon}
    </button>
  );
}

export function IconButtonLink({
  label,
  icon,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: Omit<ComponentProps<typeof Link>, 'children'> & IconButtonOwnProps) {
  return (
    <Link
      aria-label={label}
      title={label}
      className={iconButtonStyles(variant, size, className)}
      {...props}
    >
      {icon}
    </Link>
  );
}
