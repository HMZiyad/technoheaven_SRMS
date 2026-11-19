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
        return 'bg-blue-50 text-blue-700 ring-blue-600/20 border-blue-200';
      case Status.QUEUED:
        return 'bg-amber-50 text-amber-700 ring-amber-600/20 border-amber-200';
      case Status.IN_PROGRESS:
        return 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 border-indigo-200 animate-pulse font-medium';
      case Status.COMPLETED:
        return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 border-emerald-200';
      case Status.FAILED:
        return 'bg-rose-50 text-rose-700 ring-rose-600/20 border-rose-200';
      case Status.CANCELLED:
        return 'bg-slate-100 text-slate-600 ring-slate-500/20 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-600 ring-slate-500/20 border-slate-200';
    }
  };

  const formatText = (s: string) => {
    return s.replace(/_/g, ' ');
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset border',
        getStyle(status),
        className
      )}
    >
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
        return 'bg-rose-100 text-rose-800 ring-rose-600/30 border-rose-200 font-semibold';
      case Priority.HIGH:
        return 'bg-orange-100 text-orange-800 ring-orange-600/20 border-orange-200';
      case Priority.MEDIUM:
        return 'bg-yellow-50 text-yellow-800 ring-yellow-600/20 border-yellow-200';
      case Priority.LOW:
        return 'bg-slate-100 text-slate-700 ring-slate-500/20 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 ring-slate-500/20 border-slate-200';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset border',
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
        return 'bg-purple-100 text-purple-800 ring-purple-600/20 border-purple-200 font-semibold';
      case Role.SUPERVISOR:
        return 'bg-sky-100 text-sky-800 ring-sky-600/20 border-sky-200 font-medium';
      case Role.OPERATOR:
        return 'bg-slate-100 text-slate-700 ring-slate-500/20 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 ring-slate-500/20 border-slate-200';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset border',
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
