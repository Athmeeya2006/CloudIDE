import { useEffect, useCallback } from 'react';
import { EditorTabs } from './EditorTabs';
import { MonacoEditor } from './MonacoEditor';
import { getRunConfig, buildRunCommand } from './runConfig';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';
import { Play, Settings } from 'lucide-react';

export function EditorArea() {
  const { openTabs, activeTabPath, workspace } = useFileStore();
  const { notify, openSettings } = useUIStore();

  const handleRun = useCallback(async () => {
    const { activeTabPath: path, workspace: ws } = useFileStore.getState();
    if (!path) return;

    try {
      await useFileStore.getState().saveActiveFile();
    } catch {
      // saveFile already surfaced a notification.
      return;
    }

    const run = buildRunCommand(path, ws);
    if (!run) {
      const ext = path.split('.').pop()?.toLowerCase() ?? '';
      notify(`Running .${ext} files is not supported. Use the terminal`, 'error');
      return;
    }

    // Queue the command; the terminal flushes it once connected (and this also
    // opens/reveals the terminal panel). No fragile timing assumptions.
    useUIStore.getState().runInTerminal(run.command);
    notify(`Running ${run.displayName}`, 'success');
  }, [notify]);

  // F5 shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F5' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun]);

  const runConfig = activeTabPath ? getRunConfig(activeTabPath, workspace) : null;

  return (
    <div className="h-full flex flex-col bg-ide-bg overflow-hidden">
      {/* Toolbar */}
      {openTabs.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1 bg-[#252526] border-b border-ide-border shrink-0 min-h-[32px]">
          <Breadcrumb path={activeTabPath} />
          <div className="flex items-center gap-1 shrink-0">
            {runConfig && (
              <button
                onClick={handleRun}
                title={`Run ${runConfig.displayName} (F5)`}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] bg-[#1a8a3c] hover:bg-[#1fa846] text-white transition-colors rounded"
              >
                <Play size={10} fill="white" />
                <span>Run</span>
              </button>
            )}
            <button
              onClick={openSettings}
              title="Editor Settings (Ctrl+,)"
              className="p-1.5 text-ide-text-dim hover:text-ide-text hover:bg-ide-hover rounded transition-colors"
            >
              <Settings size={13} />
            </button>
          </div>
        </div>
      )}

      <EditorTabs />

      <div className="flex-1 overflow-hidden">
        {openTabs.length === 0 ? <WelcomeScreen /> : <MonacoEditor />}
      </div>
    </div>
  );
}

function Breadcrumb({ path }: { path: string | null }) {
  if (!path) return <div />;
  const parts = path.split('/').filter(Boolean);
  return (
    <div className="flex items-center gap-0.5 text-[12px] text-ide-text-muted overflow-hidden min-w-0">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-0.5 min-w-0">
          {i > 0 && <span className="text-ide-text-dim shrink-0 mx-0.5">/</span>}
          <span
            className={cn(
              'truncate',
              i === parts.length - 1 ? 'text-ide-text' : 'text-ide-text-muted',
            )}
            style={{ maxWidth: i === parts.length - 1 ? 200 : 120 }}
          >
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}

function cn(...args: (string | boolean | undefined)[]) {
  return args.filter(Boolean).join(' ');
}

function WelcomeScreen() {
  const { openCloneDialog, openQuickOpen } = useUIStore();
  const shortcuts = [
    ['Ctrl+P',       'Go to File'],
    ['Ctrl+S',       'Save File'],
    ['F5',           'Run File'],
    ['Ctrl+`',       'Toggle Terminal'],
    ['Ctrl+Shift+E', 'File Explorer'],
    ['Ctrl+Shift+F', 'Search Files'],
    ['Ctrl+,',       'Settings'],
    ['Ctrl+Z',       'Undo'],
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center text-ide-text-muted p-8 overflow-auto">
      <div className="text-[60px] mb-5 opacity-[0.07] select-none leading-none">⬡</div>
      <div className="text-[22px] font-light text-ide-text mb-1 tracking-tight">Cloud IDE</div>
      <div className="text-[13px] text-ide-text-dim mb-10 opacity-70">
        Full-stack dev environment in your browser
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[12px] w-[360px] mb-8">
        {shortcuts.map(([key, label]) => (
          <div
            key={key}
            className="flex items-center gap-2 bg-[#252526] border border-[#3e3e3e] px-3 py-2 rounded"
          >
            <kbd className="text-ide-accent font-mono text-[11px] shrink-0">{key}</kbd>
            <span className="text-ide-text-dim truncate">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={openQuickOpen}
          className="px-4 py-2 bg-ide-accent hover:bg-[#1a8ad4] text-white text-[13px] rounded transition-colors"
        >
          Open File
        </button>
        <button
          onClick={openCloneDialog}
          className="px-4 py-2 border border-ide-border hover:border-ide-accent text-ide-text text-[13px] rounded transition-colors"
        >
          Clone Repository
        </button>
      </div>
    </div>
  );
}
