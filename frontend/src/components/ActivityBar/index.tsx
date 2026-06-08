import {
  Files, Search, GitBranch, Database,
  Settings,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useProcessStore } from '../../stores/processStore';
import { cn } from '../../utils';
import type { SidebarView } from '../../types';

interface NavItem {
  id: SidebarView;
  icon: React.ReactNode;
  title: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'explorer', icon: <Files size={22} />, title: 'Explorer (Ctrl+Shift+E)' },
  { id: 'search', icon: <Search size={22} />, title: 'Search (Ctrl+Shift+F)' },
  { id: 'git', icon: <GitBranch size={22} />, title: 'Source Control' },
  { id: 'database', icon: <Database size={22} />, title: 'Database Viewer' },
];

export function ActivityBar() {
  const { sidebarView, setSidebarView, sidebarOpen, toggleSidebar } = useUIStore();
  const { processes } = useProcessStore();
  const hasRunning = processes.some(p => p.status === 'running');

  const handleClick = (id: SidebarView) => {
    if (sidebarView === id && sidebarOpen) {
      toggleSidebar();
    } else {
      setSidebarView(id);
      if (!sidebarOpen) toggleSidebar();
    }
  };

  return (
    <div className="w-12 bg-ide-activity flex flex-col items-center py-1 border-r border-ide-border shrink-0">
      <div className="flex flex-col items-center gap-0.5 w-full">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            title={item.title}
            onClick={() => handleClick(item.id)}
            className={cn(
              'w-full flex items-center justify-center h-12 relative transition-colors',
              sidebarView === item.id && sidebarOpen
                ? 'text-ide-text after:absolute after:left-0 after:top-0 after:bottom-0 after:w-[2px] after:bg-ide-accent'
                : 'text-ide-text-dim hover:text-ide-text',
            )}
          >
            {item.icon}
            {item.id === 'git' && hasRunning && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-ide-green" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-0.5 w-full pb-1">
        <button
          title="Settings"
          className="w-full flex items-center justify-center h-12 text-ide-text-dim hover:text-ide-text transition-colors"
        >
          <Settings size={22} />
        </button>
      </div>
    </div>
  );
}
