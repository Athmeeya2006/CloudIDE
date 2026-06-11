import { useUIStore } from '../../stores/uiStore';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils';
 
export function Notification() {
  const { notification } = useUIStore();
 
  if (!notification) return null;
 
  const cfg = {
    success: {
      icon: <CheckCircle2 size={15} />,
      cls: 'bg-[#1a472a] border-[#2d6a3f] text-[#4ec9b0]',
      bar: 'bg-[#4ec9b0]',
    },
    error: {
      icon: <XCircle size={15} />,
      cls: 'bg-[#3d1212] border-[#6a2020] text-[#f14c4c]',
      bar: 'bg-[#f14c4c]',
    },
    info: {
      icon: <Info size={15} />,
      cls: 'bg-[#1e3a5f] border-[#2c5282] text-[#9cdcfe]',
      bar: 'bg-[#007fd4]',
    },
  }[notification.type];
 
  return (
    <div
      role="alert"
      className={cn(
        'fixed bottom-10 right-4 z-[9999] flex items-center gap-3 pr-3 pl-4 py-3',
        'border shadow-2xl min-w-[260px] max-w-sm animate-fade-in overflow-hidden',
        cfg.cls,
      )}
    >
      <div
        className={cn('absolute bottom-0 left-0 h-[2px]', cfg.bar)}
        style={{ animation: 'shrink 3.5s linear forwards' }}
      />
 
      <span className="shrink-0">{cfg.icon}</span>
      <span className="flex-1 text-[13px] font-medium leading-snug">{notification.message}</span>
      <button
        onClick={() => useUIStore.setState({ notification: null })}
        className="p-0.5 opacity-60 hover:opacity-100 transition-opacity shrink-0"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
 
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
