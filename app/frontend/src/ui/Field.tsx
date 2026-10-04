import { useState, type ComponentProps, type ReactNode } from 'react';
import { ImagePlus } from 'lucide-react';
import { cn } from './cn';

interface FieldProps {
  label: ReactNode;
  /** id of the control; wires up the `<label htmlFor>`. Omit for controls that label themselves. */
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Label + control + hint/error. Wrap every form control in a Field. */
export function Field({ label, htmlFor, hint, error, children, className }: FieldProps) {
  const LabelTag = htmlFor ? 'label' : 'span';
  return (
    <div className={cn('space-y-1.5', className)}>
      <LabelTag htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </LabelTag>
      {children}
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : (
        hint && <p className="text-sm text-ink-subtle">{hint}</p>
      )}
    </div>
  );
}

const controlBase =
  'w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-ink shadow-sm transition-colors placeholder:text-ink-subtle hover:border-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 focus-visible:ring-offset-0 disabled:bg-surface-muted';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(controlBase, 'h-11', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(controlBase, 'min-h-24 py-2.5', className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        controlBase,
        'h-11 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.875rem_center] bg-no-repeat pr-10',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238b8b9b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    />
  );
}

interface ImagePickerProps extends Omit<ComponentProps<'input'>, 'type' | 'onChange'> {
  onFileChange: (file: File | null) => void;
}

/** Image upload drop target with preview. Pair with `<Field htmlFor={id}>`. */
export function ImagePicker({ id, onFileChange, className, ...props }: ImagePickerProps) {
  const [preview, setPreview] = useState<string | null>(null);

  const handleChange = (file: File | null) => {
    onFileChange(file);
    setPreview(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  return (
    <div className={className}>
      <input
        id={id}
        type="file"
        accept="image/*"
        className="peer sr-only"
        onChange={(e) => handleChange(e.target.files?.[0] || null)}
        {...props}
      />
      <label
        htmlFor={id}
        className="flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-line-strong bg-surface-muted text-ink-muted transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500"
      >
        {preview ? (
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          <>
            <ImagePlus aria-hidden="true" className="size-8" />
            <span className="text-sm font-medium">Choose a photo</span>
          </>
        )}
      </label>
    </div>
  );
}
