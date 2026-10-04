import { cn } from './cn';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const sizes: Record<AvatarSize, string> = {
  sm: 'size-8 text-xs',
  md: 'size-12 text-base',
  lg: 'size-16 text-xl',
  xl: 'size-24 text-3xl',
};

interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  className?: string;
}

/** Round photo; falls back to a tinted initial (not an `img`) when there is no `src`. */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const classes = cn(
    'shrink-0 rounded-full object-cover ring-2 ring-surface shadow-card',
    sizes[size],
    className,
  );
  if (src) return <img src={src} alt={name} className={classes} />;
  return (
    <span
      aria-hidden="true"
      className={cn(
        classes,
        'inline-flex items-center justify-center bg-brand-100 font-semibold text-brand-700',
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
