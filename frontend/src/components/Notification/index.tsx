import { useUIStore } from '../../stores/uiStore';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '../../utils';

export function Notification() {
  const { notification } = useUIStore();

  if (!notification) return null;

  const config = {
    success: { icon: <CheckCircle size={14} />, cls: 'bg-[#1a472a] border-[#2d6a3f] text-[#4ec9b0]' },
    error:   { icon: <AlertCircle size={14} />,  cls: 'bg-[#3d1212] border-[#6a2020] text-[#f44747]' },
    info:    { icon: <Info size={14} />,          cls: 'bg-[#1e3a5f] border-[#2c5282] text-[#9cdcfe]' },
  }[notification.type];

  return (
    <div
      className={cn(
        'fixed bottom-8 right-4 z-[9999] flex items-center gap-2 px-4 py-2.5 border text-[13px] shadow-xl animate-fade-in max-w-sm',
        config.cls,
      )}
    >
      {config.icon}
      <span className="flex-1">{notification.message}</span>
    </div>
  );
}
