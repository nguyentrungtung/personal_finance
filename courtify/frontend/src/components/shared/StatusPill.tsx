import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

type Status = 'completed' | 'pending' | 'appraisal' | 'cleared' | 'active' | 'overdue' | 'settled' | 'matured' | 'withdrawn' | string;

interface StatusPillProps {
  status: Status;
  className?: string;
}

const STATUS_CONFIG: Record<string, { className: string }> = {
  completed: { className: 'bg-brand-green/15 text-brand-green border-brand-green/30' },
  active: { className: 'bg-brand-green/15 text-brand-green border-brand-green/30' },
  settled: { className: 'bg-text-muted/15 text-text-muted border-text-muted/30' },
  cleared: { className: 'bg-text-muted/15 text-text-muted border-text-muted/30' },
  withdrawn: { className: 'bg-text-muted/15 text-text-muted border-text-muted/30' },
  pending: { className: 'bg-brand-amber/15 text-brand-amber border-brand-amber/30' },
  appraisal: { className: 'bg-brand-amber/15 text-brand-amber border-brand-amber/30' },
  overdue: { className: 'bg-brand-amber/15 text-brand-amber border-brand-amber/30' },
  matured: { className: 'bg-brand-amber/15 text-brand-amber border-brand-amber/30' },
};

export function StatusPill({ status, className }: StatusPillProps) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status] ?? {
    className: 'bg-text-muted/15 text-text-muted border-text-muted/30',
  };

  const label = t(`enums.statuses.${status}` as any, {
    defaultValue: status.charAt(0).toUpperCase() + status.slice(1)
  });

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        config.className,
        className
      )}
    >
      {label}
    </span>
  );
}
