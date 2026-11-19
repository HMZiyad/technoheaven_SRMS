import React from 'react';
import { Status } from '../../types';
import { cn } from '../../utils/cn';

interface ProgressBarProps {
  progress: number;
  status?: Status | string;
  currentStage?: string | null;
  showStages?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STAGES = [
  { name: 'Validate', target: 25 },
  { name: 'Allocate', target: 50 },
  { name: 'Process', target: 85 },
  { name: 'Finalize', target: 100 },
];

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  status = Status.IN_PROGRESS,
  currentStage,
  showStages = false,
  size = 'md',
  className,
}) => {
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  const getBarColor = () => {
    switch (status) {
      case Status.COMPLETED:
        return 'bg-emerald-500';
      case Status.FAILED:
        return 'bg-rose-500';
      case Status.CANCELLED:
        return 'bg-slate-400';
      case Status.IN_PROGRESS:
        return 'bg-indigo-600 bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600';
      case Status.QUEUED:
        return 'bg-amber-500';
      default:
        return 'bg-primary-600';
    }
  };

  const getHeightClass = () => {
    switch (size) {
      case 'sm':
        return 'h-1.5';
      case 'lg':
        return 'h-3.5';
      case 'md':
      default:
        return 'h-2.5';
    }
  };

  return (
    <div className={cn('w-full flex flex-col gap-1.5', className)}>
      {/* Progress track */}
      <div className={cn('w-full bg-slate-100 rounded-full overflow-hidden shadow-inner', getHeightClass())}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            getBarColor(),
            status === Status.IN_PROGRESS && 'animate-pulse'
          )}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>

      {/* Optional stage indicators below the track */}
      {showStages && (
        <div className="pt-2">
          <div className="flex justify-between items-center text-[11px] font-medium text-slate-500">
            {STAGES.map((stage) => {
              const isPassed = clampedProgress >= stage.target || status === Status.COMPLETED;
              const isCurrent =
                (currentStage && currentStage.toLowerCase() === stage.name.toLowerCase()) ||
                (!isPassed && clampedProgress >= stage.target - 25);

              return (
                <div key={stage.name} className="flex flex-col items-center">
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full mb-1 transition-colors',
                      status === Status.FAILED && isCurrent
                        ? 'bg-rose-500 ring-2 ring-rose-200'
                        : isPassed
                        ? 'bg-emerald-500'
                        : isCurrent
                        ? 'bg-indigo-600 ring-2 ring-indigo-200 animate-pulse'
                        : 'bg-slate-300'
                    )}
                  />
                  <span
                    className={cn(
                      'transition-colors',
                      status === Status.FAILED && isCurrent
                        ? 'text-rose-600 font-semibold'
                        : isPassed
                        ? 'text-emerald-700 font-medium'
                        : isCurrent
                        ? 'text-indigo-600 font-bold'
                        : 'text-slate-400'
                    )}
                  >
                    {stage.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
