import { useRef } from 'react';
import { X, Circle } from 'lucide-react';
import { useFileStore } from '../../stores/fileStore';
import { getFileIcon, cn } from '../../utils';

export function EditorTabs() {
  const { openTabs, activeTabPath, setActiveTab, closeTab } = useFileStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (openTabs.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="flex items-end bg-[#2d2d2d] border-b border-ide-border overflow-x-auto shrink-0"
      style={{ scrollbarWidth: 'none' }}
    >
      {openTabs.map(tab => {
        const isActive = tab.path === activeTabPath;
        return (
          <div
            key={tab.path}
            className={cn(
              'flex items-center gap-1.5 px-3 h-9 text-[13px] cursor-pointer shrink-0 border-r border-ide-border group relative',
              'transition-colors max-w-[180px]',
              isActive
                ? 'bg-ide-bg text-ide-text border-t-[1px] border-t-ide-accent'
                : 'bg-[#2d2d2d] text-ide-text-muted hover:bg-[#393939] hover:text-ide-text',
            )}
            onClick={() => setActiveTab(tab.path)}
            onMouseDown={e => {
              if (e.button === 1) { e.preventDefault(); closeTab(tab.path); }
            }}
          >
            <span className="shrink-0 text-[12px]">{getFileIcon(tab.name)}</span>
            <span className="truncate">{tab.name}</span>

            {/* Modified indicator or close button */}
            <span className="shrink-0 w-4 h-4 flex items-center justify-center">
              {tab.modified ? (
                <Circle
                  size={8}
                  className="fill-current text-ide-text opacity-80 group-hover:hidden"
                />
              ) : null}
              <button
                className={cn(
                  'p-0.5 rounded hover:bg-[#ffffff20] transition-colors',
                  tab.modified ? 'hidden group-hover:flex' : 'opacity-0 group-hover:opacity-100',
                )}
                onClick={e => {
                  e.stopPropagation();
                  closeTab(tab.path);
                }}
                onDoubleClick={e => e.stopPropagation()}
                title="Close Tab"
              >
                <X size={13} />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
