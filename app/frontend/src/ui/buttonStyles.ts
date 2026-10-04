import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-ink-inverted shadow-brand hover:bg-brand-700',
  secondary: 'bg-surface text-ink ring-1 ring-inset ring-line-strong hover:bg-surface-muted',
  ghost: 'text-brand-700 hover:bg-brand-50',
  danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-ink-inverted',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-lg px-3 text-sm',
  md: 'h-10 rounded-xl px-4 text-sm',
  lg: 'h-12 rounded-xl px-6 text-base',
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}

/** Button classes for elements that can't use `Button`/`ButtonLink` (e.g. a plain `<a>`). */
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  block,
  className,
}: ButtonStyleOptions = {}) {
  return cn(base, variants[variant], sizes[size], block && 'w-full', className);
}
