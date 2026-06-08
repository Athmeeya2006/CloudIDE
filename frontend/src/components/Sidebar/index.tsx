import { useUIStore } from '../../stores/uiStore';
import { FileExplorer } from './FileExplorer';
import { SearchPanel } from './SearchPanel';
import { GitPanel } from './GitPanel';
import { DatabasePanel } from './DatabasePanel';

export function Sidebar() {
  const { sidebarView } = useUIStore();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {sidebarView === 'explorer' && <FileExplorer />}
      {sidebarView === 'search' && <SearchPanel />}
      {sidebarView === 'git' && <GitPanel />}
      {sidebarView === 'database' && <DatabasePanel />}
    </div>
  );
}
