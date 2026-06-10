import {
  Files, Search, GitBranch, Database, Settings,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../utils';
import type { SidebarView } from '../../types';

interface NavItem {
  id: SidebarView;
  icon: React.ReactNode;
  title: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'explorer',  icon: <Files size={22} />,     title: 'Explorer (Ctrl+Shift+E)' },
  { id: 'search',    icon: <Search size={22} />,     title: 'Search (Ctrl+Shift+F)' },
  { id: 'git',       icon: <GitBranch size={22} />,  title: 'Source Control' },
  { id: 'database',  icon: <Database size={22} />,   title: 'Database Browser' },
];

export function ActivityBar() {
  const { sidebarView, setSidebarView, sidebarOpen, toggleSidebar, gitChanges, openSettings } = useUIStore();

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
        {NAV_ITEMS.map(item => {
          const isActive = sidebarView === item.id && sidebarOpen;
          const showBadge = item.id === 'git' && gitChanges > 0;
          return (
            <button
              key={item.id}
              title={item.title}
              onClick={() => handleClick(item.id)}
              className={cn(
                'w-full flex items-center justify-center h-12 relative transition-colors group',
                isActive
                  ? 'text-ide-text after:absolute after:left-0 after:top-0 after:bottom-0 after:w-[2px] after:bg-ide-accent'
                  : 'text-ide-text-dim hover:text-ide-text',
              )}
            >
              {item.icon}
              {showBadge && (
                <span
                  className="absolute top-1.5 right-1.5 min-w-[16px] h-4 rounded-full bg-ide-accent text-white text-[9px] font-bold flex items-center justify-center px-1"
                  aria-label={`${gitChanges} changes`}
                >
                  {gitChanges > 99 ? '99+' : gitChanges}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <button
        title="Settings (Ctrl+,)"
        onClick={openSettings}
        className="w-full flex items-center justify-center h-12 text-ide-text-dim hover:text-ide-text transition-colors"
      >
        <Settings size={22} />
      </button>
    </div>
  );
}
