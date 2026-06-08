import { useUIStore } from '../stores/uiStore';
import { cn } from '../utils';

export function Notification() {
  const { notification } = useUIStore();
  if (!notification) return null;

  const colors = {
    info: 'bg-ide-accent',
    success: 'bg-ide-green',
    error: 'bg-ide-red',
  };

  return (
    <div className={cn('fixed bottom-10 right-4 z-50 px-4 py-2 rounded shadow-lg text-white text-[13px] animate-slide-in', colors[notification.type])}>
      {notification.message}
    </div>
  );
}
