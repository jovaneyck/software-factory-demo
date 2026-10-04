import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { buttonStyles, type ButtonSize, type ButtonVariant } from './buttonStyles';
import { Spinner } from './Spinner';

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Icon rendered before the label (e.g. `<Plus />` from lucide-react). */
  icon?: ReactNode;
}

export type ButtonProps = ComponentProps<'button'> &
  ButtonOwnProps & {
    /** Shows a spinner and disables the button. */
    loading?: boolean;
  };

export function Button({
  variant,
  size,
  block,
  icon,
  loading,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={buttonStyles({ variant, size, block, className })}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
}

export type ButtonLinkProps = ComponentProps<typeof Link> & ButtonOwnProps;

/** A react-router `Link` that looks like a `Button`. */
export function ButtonLink({
  variant,
  size,
  block,
  icon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonStyles({ variant, size, block, className })} {...props}>
      {icon}
      {children}
    </Link>
  );
}
