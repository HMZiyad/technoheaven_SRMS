import React from 'react';
import { Status, Priority, Role } from '../../types';
import { cn } from '../../utils/cn';

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const getStyle = (s: string) => {
    switch (s) {
      case Status.SUBMITTED:
        return {
          pill: 'bg-blue-50 text-blue-700 border-blue-200/90',
          dot: 'bg-blue-500',
        };
      case Status.QUEUED:
        return {
          pill: 'bg-amber-50 text-amber-700 border-amber-200/90',
          dot: 'bg-amber-500',
        };
      case Status.IN_PROGRESS:
        return {
          pill: 'bg-indigo-50 text-indigo-700 border-indigo-200/90',
          dot: 'bg-indigo-500 animate-pulse',
        };
      case Status.COMPLETED:
        return {
          pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/90',
          dot: 'bg-emerald-500',
        };
      case Status.FAILED:
        return {
          pill: 'bg-rose-50 text-rose-700 border-rose-200/90',
          dot: 'bg-rose-500',
        };
      case Status.CANCELLED:
        return {
          pill: 'bg-slate-100 text-slate-600 border-slate-200',
          dot: 'bg-slate-400',
        };
      default:
        return {
          pill: 'bg-slate-100 text-slate-600 border-slate-200',
          dot: 'bg-slate-400',
        };
    }
  };

  const formatText = (s: string) => {
    return s.replace(/_/g, ' ');
  };

  const style = getStyle(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border tracking-wide uppercase',
        style.pill,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', style.dot)} />
      {formatText(status)}
    </span>
  );
};

interface PriorityBadgeProps {
  priority: Priority | string;
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className }) => {
  const getStyle = (p: string) => {
    switch (p) {
      case Priority.URGENT:
        return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
      case Priority.HIGH:
        return 'bg-orange-50 text-orange-700 border-orange-200 font-semibold';
      case Priority.MEDIUM:
        return 'bg-amber-50/80 text-amber-700 border-amber-200 font-medium';
      case Priority.LOW:
        return 'bg-slate-100 text-slate-600 border-slate-200 font-medium';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200 font-medium';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-[11px] tracking-wide uppercase border',
        getStyle(priority),
        className
      )}
    >
      {priority}
    </span>
  );
};

interface RoleBadgeProps {
  role: Role | string;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className }) => {
  const getStyle = (r: string) => {
    switch (r) {
      case Role.ADMIN:
        return 'bg-purple-50 text-purple-700 border-purple-200 font-semibold';
      case Role.SUPERVISOR:
        return 'bg-sky-50 text-sky-700 border-sky-200 font-semibold';
      case Role.OPERATOR:
        return 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase border',
        getStyle(role),
        className
      )}
    >
      {role}
    </span>
  );
};

export default {
  StatusBadge,
  PriorityBadge,
  RoleBadge,
};
