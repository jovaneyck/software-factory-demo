import type { ReactNode } from 'react';

interface ModalShellProps {
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly contentClassName?: string;
}

/**
 * Shared overlay for modals. Clicking the backdrop closes the modal. The
 * backdrop is a native button so it is keyboard accessible, which also keeps
 * the content panel free of click-handler-only interactive elements.
 */
function ModalShell({ onClose, children, contentClassName = '' }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-black/30 cursor-default"
      />
      <div className={`relative bg-white rounded-2xl w-full max-w-lg mx-4 p-6 ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}

export default ModalShell;
