import { useFileStore } from '../../stores/fileStore';
import { useProcessStore } from '../../stores/processStore';
import { useUIStore } from '../../stores/uiStore';
import { getLanguage } from '../../utils';
import { GitBranch, Eye, TerminalSquare, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import { cn } from '../../utils';
 
export function StatusBar() {
  const { openTabs, activeTabPath } = useFileStore();
  const { processes } = useProcessStore();
  const { openBottom, togglePreview, previewOpen, openSidebar, gitBranch, gitChanges, openQuickOpen } = useUIStore();
 
  const activeTab = openTabs.find(t => t.path === activeTabPath);
  const runningProcs = processes.filter(p => p.status === 'running');
  const errorProcs   = processes.filter(p => p.status === 'error');
  const lang         = activeTab ? getLanguage(activeTab.name) : '';
 
  return (
    <div className="h-6 bg-ide-status flex items-center text-[11px] text-white shrink-0 select-none overflow-hidden">
      <button
        className="flex items-center gap-1 px-3 h-full hover:bg-white/10 transition-colors shrink-0"
        onClick={() => openSidebar('git')}
        title={gitBranch ? `Branch: ${gitBranch}` : 'Source Control'}
      >
        <GitBranch size={11} />
        <span className="truncate max-w-[120px]">
          {gitBranch || 'no git'}
        </span>
        {gitChanges > 0 && (
          <span className="bg-white/20 px-1 rounded text-[9px] font-bold">
            {gitChanges}
          </span>
        )}
      </button>
 
      {runningProcs.length > 0 && (
        <button
          onClick={() => openBottom('logs')}
          className="flex items-center gap-1 px-2 h-full hover:bg-white/10 transition-colors shrink-0"
          title={`${runningProcs.length} running process${runningProcs.length > 1 ? 'es' : ''}`}
        >
          <CheckCircle size={10} className="text-green-300" />
          <span>{runningProcs.length} running</span>
        </button>
      )}
      {errorProcs.length > 0 && (
        <button
          onClick={() => openBottom('logs')}
          className="flex items-center gap-1 px-2 h-full hover:bg-red-700 transition-colors text-red-200 shrink-0"
        >
          <AlertCircle size={10} />
          <span>{errorProcs.length} error</span>
        </button>
      )}
 
      <div className="flex-1" />
 
      {activeTab && (
        <div className="flex items-center gap-3 px-3">
          <button
            onClick={openQuickOpen}
            className="flex items-center gap-1 hover:bg-white/10 px-1 rounded transition-colors"
            title="Go to File (Ctrl+P)"
          >
            <Zap size={10} className="opacity-70" />
            <span className="opacity-80 max-w-[160px] truncate">{activeTab.name}</span>
          </button>
          {lang && (
            <span className="capitalize opacity-70">{lang}</span>
          )}
          {activeTab.modified && (
            <span className="opacity-60 text-yellow-300">● unsaved</span>
          )}
        </div>
      )}
 
      <div className="flex-1" />
 
      <div className="flex items-center shrink-0">
        <button
          onClick={() => openBottom('terminal')}
          className={cn('flex items-center gap-1 px-3 h-full hover:bg-white/10 transition-colors opacity-75 hover:opacity-100')}
          title="Terminal (Ctrl+`)"
        >
          <TerminalSquare size={11} />
          <span className="hidden sm:inline">Terminal</span>
        </button>
        <button
          onClick={togglePreview}
          className={cn(
            'flex items-center gap-1 px-3 h-full hover:bg-white/10 transition-colors',
            previewOpen ? 'opacity-100 bg-white/15' : 'opacity-75 hover:opacity-100',
          )}
          title="Toggle Preview"
        >
          <Eye size={11} />
          <span className="hidden sm:inline">Preview</span>
        </button>
        <span className="px-2 opacity-50 hidden md:inline">UTF-8</span>
        <span className="px-2 opacity-50 hidden md:inline">LF</span>
      </div>
    </div>
  );
}
