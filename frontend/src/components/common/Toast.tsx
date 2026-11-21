import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, ToastItem } from '../../store/toastStore';
import { cn } from '../../utils/cn';

export const Toast: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.slice(-2).map((toast) => (
        <ToastCard key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

interface ToastCardProps {
  toast: ToastItem;
  onClose: () => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onClose }) => {
  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'bg-white border-emerald-200 text-slate-800 shadow-emerald-500/10',
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />,
          bar: 'bg-emerald-500',
        };
      case 'error':
        return {
          bg: 'bg-white border-rose-200 text-slate-800 shadow-rose-500/10',
          icon: <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />,
          bar: 'bg-rose-500',
        };
      case 'warning':
        return {
          bg: 'bg-white border-amber-200 text-slate-800 shadow-amber-500/10',
          icon: <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />,
          bar: 'bg-amber-500',
        };
      case 'info':
      default:
        return {
          bg: 'bg-white border-blue-200 text-slate-800 shadow-blue-500/10',
          icon: <Info className="h-5 w-5 text-blue-600 shrink-0" />,
          bar: 'bg-blue-500',
        };
    }
  };

  const style = getStyles();

  return (
    <div
      className={cn(
        'pointer-events-auto relative overflow-hidden flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all duration-300 transform translate-y-0',
        style.bg
      )}
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-1.5', style.bar)} />
      <div className="pt-0.5">{style.icon}</div>
      <div className="flex-1 min-w-0 pr-2">
        {toast.title && <h4 className="text-sm font-semibold text-slate-900 mb-0.5">{toast.title}</h4>}
        <p className="text-xs text-slate-600 break-words">{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default Toast;
