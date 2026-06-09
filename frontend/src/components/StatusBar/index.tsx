import { useFileStore } from '../../stores/fileStore';
import { useProcessStore } from '../../stores/processStore';
import { useUIStore } from '../../stores/uiStore';
import { getLanguage } from '../../utils';
import { GitBranch, Eye, Terminal, AlertCircle, CheckCircle } from 'lucide-react';

export function StatusBar() {
  const { openTabs, activeTabPath } = useFileStore();
  const { processes } = useProcessStore();
  const { openBottom, togglePreview, previewOpen } = useUIStore();

  const activeTab = openTabs.find(t => t.path === activeTabPath);
  const runningProcs = processes.filter(p => p.status === 'running');
  const errorProcs   = processes.filter(p => p.status === 'error');

  return (
    <div className="h-6 bg-ide-status flex items-center px-3 text-[11px] text-white shrink-0 select-none">
      {/* Left section */}
      <div className="flex items-center gap-3 flex-1">
        {/* Git branch (placeholder — real value comes from GitPanel) */}
        <button
          className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
          onClick={() => useUIStore.getState().openSidebar('git')}
          title="Source Control"
        >
          <GitBranch size={12} />
          <span>main</span>
        </button>

        {/* Process status */}
        {runningProcs.length > 0 && (
          <button
            onClick={() => openBottom('logs')}
            className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
          >
            <CheckCircle size={11} />
            <span>{runningProcs.length} running</span>
          </button>
        )}
        {errorProcs.length > 0 && (
          <button
            onClick={() => openBottom('logs')}
            className="flex items-center gap-1 text-red-300 hover:text-red-100 transition-colors"
          >
            <AlertCircle size={11} />
            <span>{errorProcs.length} error</span>
          </button>
        )}
      </div>

      {/* Center section */}
      <div className="flex items-center gap-3">
        {activeTab && (
          <>
            <span className="opacity-70">{activeTab.name}</span>
            <span className="opacity-70 capitalize">{getLanguage(activeTab.name)}</span>
            {activeTab.modified && (
              <span className="opacity-70">● modified</span>
            )}
          </>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3 flex-1 justify-end">
        <button
          onClick={() => openBottom('terminal')}
          className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
        >
          <Terminal size={11} />
          <span>Terminal</span>
        </button>

        <button
          onClick={togglePreview}
          className={`flex items-center gap-1 transition-opacity ${previewOpen ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
          title="Toggle Preview"
        >
          <Eye size={11} />
          <span>Preview</span>
        </button>

        {/* Encoding / line ending */}
        <span className="opacity-60">UTF-8</span>
        <span className="opacity-60">LF</span>
        <span className="opacity-60">Spaces: 2</span>
      </div>
    </div>
  );
}
