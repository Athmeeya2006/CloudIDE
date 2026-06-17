import { useRef } from 'react';
import { X, Circle } from 'lucide-react';
import { useFileStore } from '../../stores/fileStore';
import { getFileIcon, cn } from '../../utils';
 
export function EditorTabs() {
  const { openTabs, activeTabPath, setActiveTab, closeTab, saveFile } = useFileStore();
  const scrollRef = useRef<HTMLDivElement>(null);
 
  if (openTabs.length === 0) return null;
 
  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };
 
  return (
    <div
      ref={scrollRef}
      className="flex items-end bg-[#2d2d2d] border-b border-ide-border overflow-x-auto shrink-0"
      style={{ scrollbarWidth: 'none' }}
      onWheel={handleWheel}
    >
      {openTabs.map(tab => {
        const isActive = tab.path === activeTabPath;
        return (
          <div
            key={tab.path}
            className={cn(
              'flex items-center gap-1.5 px-3 h-9 text-[13px] cursor-pointer shrink-0 border-r border-ide-border group relative',
              'transition-colors select-none',
              isActive
                ? 'bg-ide-bg text-ide-text border-t-[2px] border-t-ide-accent mt-[2px]'
                : 'bg-[#2d2d2d] text-ide-text-muted hover:bg-[#393939] hover:text-ide-text border-t-[2px] border-t-transparent',
            )}
            style={{ maxWidth: 180 }}
            title={tab.path}
            onClick={() => setActiveTab(tab.path)}
            onDoubleClick={() => saveFile(tab.path)}
            onMouseDown={e => {
              if (e.button === 1) { e.preventDefault(); closeTab(tab.path); }
            }}
          >
            <span className="shrink-0 text-[11px]">{getFileIcon(tab.name)}</span>
            <span className="truncate flex-1 min-w-0">{tab.name}</span>
 
            {/* Modified dot or close button */}
            <span className="shrink-0 w-4 h-4 flex items-center justify-center">
              {tab.modified ? (
                <>
                  <Circle
                    size={7}
                    className="fill-current text-ide-text opacity-70 group-hover:hidden"
                  />
                  <button
                    className="hidden group-hover:flex items-center justify-center p-0.5 rounded hover:bg-white/20 transition-colors"
                    onClick={e => { e.stopPropagation(); closeTab(tab.path); }}
                    title="Close (unsaved changes)"
                  >
                    <X size={12} />
                  </button>
                </>
              ) : (
                <button
                  className="flex items-center justify-center p-0.5 rounded hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={e => { e.stopPropagation(); closeTab(tab.path); }}
                  title="Close"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          </div>
        );
      })}
 
      {/* Right padding so last tab doesn't feel cramped */}
      <div className="flex-1 min-w-[20px] h-9" />
    </div>
  );
}
