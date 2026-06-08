import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';

export function StatusBar() {
  const { openTabs, activeTabPath } = useFileStore();
  const { bottomOpen, toggleBottom } = useUIStore();
  const activeTab = openTabs.find(t => t.path === activeTabPath);

  return (
    <div className="h-6 bg-ide-status flex items-center justify-between px-3 text-white text-[11px] shrink-0">
      <div className="flex items-center gap-3">
        <span className="hover:bg-white/10 px-1.5 cursor-pointer" onClick={toggleBottom}>
          {bottomOpen ? '⌄' : '⌃'} Terminal
        </span>
      </div>
      <div className="flex items-center gap-3">
        {activeTab && (
          <>
            <span>{activeTab.name}</span>
            {activeTab.modified && <span className="text-yellow-300">● Modified</span>}
          </>
        )}
        <span>UTF-8</span>
        <span>LF</span>
      </div>
    </div>
  );
}
