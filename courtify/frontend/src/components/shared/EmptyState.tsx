import type { ReactNode } from 'react';

type ActionProp = ReactNode | { label: string; onClick: () => void };

interface EmptyStateProps {
  illustration?: ReactNode;
  title: string;
  description?: string;
  action?: ActionProp;
  className?: string;
}

function resolveAction(action: ActionProp): ReactNode {
  if (action && typeof action === 'object' && 'label' in (action as object) && 'onClick' in (action as object)) {
    const a = action as { label: string; onClick: () => void };
    return (
      <button
        type="button"
        onClick={a.onClick}
        className="px-4 py-2 rounded-lg bg-brand-green text-black text-sm font-medium hover:opacity-90"
      >
        {a.label}
      </button>
    );
  }
  return action as ReactNode;
}

export function EmptyState({ illustration, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-8 text-center ${className}`}>
      {illustration && (
        <div className="mb-6 text-text-muted opacity-60" aria-hidden="true">
          {illustration}
        </div>
      )}
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary max-w-sm mb-6">{description}</p>
      )}
      {action && <div>{resolveAction(action)}</div>}
    </div>
  );
}
