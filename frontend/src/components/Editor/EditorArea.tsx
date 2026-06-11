import { useEffect, useCallback } from 'react';
import { EditorTabs } from './EditorTabs';
import { MonacoEditor } from './MonacoEditor';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';
import { Play, Settings } from 'lucide-react';

function getRunConfig(activeTabPath: string, workspace: string): { command: string; displayName: string; cwd: string } | null {
  const parts = activeTabPath.split('/');
  const filename = parts[parts.length - 1];
  const fileDir = parts.slice(0, -1).join('/') || workspace;
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const base = filename.substring(0, filename.lastIndexOf('.')) || filename;

  if (filename === 'package.json') {
    return { command: 'npm run dev', displayName: 'npm dev', cwd: fileDir };
  }

  const runners: Record<string, { command: string; displayName: string }> = {
    py:   { command: `python3 -u "${filename}"`,                      displayName: `Python: ${filename}` },
    js:   { command: `node "${filename}"`,                             displayName: `Node: ${filename}` },
    ts:   { command: `npx ts-node "${filename}"`,                      displayName: `TS-Node: ${filename}` },
    cpp:  { command: `g++ -Wall -O2 -o "${base}" "${filename}" && "./${base}"`, displayName: `C++: ${filename}` },
    cc:   { command: `g++ -Wall -O2 -o "${base}" "${filename}" && "./${base}"`, displayName: `C++: ${filename}` },
    c:    { command: `gcc -Wall -O2 -o "${base}" "${filename}" && "./${base}"`, displayName: `C: ${filename}` },
    go:   { command: `go run "${filename}"`,                           displayName: `Go: ${filename}` },
    rs:   { command: `rustc "${filename}" -o "${base}" && "./${base}"`, displayName: `Rust: ${filename}` },
    sh:   { command: `bash "${filename}"`,                             displayName: `Shell: ${filename}` },
    bash: { command: `bash "${filename}"`,                             displayName: `Shell: ${filename}` },
    rb:   { command: `ruby "${filename}"`,                             displayName: `Ruby: ${filename}` },
    php:  { command: `php "${filename}"`,                              displayName: `PHP: ${filename}` },
    java: { command: `javac "${filename}" && java "${base}"`,          displayName: `Java: ${filename}` },
  };

  const runner = runners[ext];
  if (!runner) return null;
  return { ...runner, cwd: fileDir };
}

export function EditorArea() {
  const { openTabs, activeTabPath, workspace, saveActiveFile } = useFileStore();
  const { openBottom, notify, openSettings } = useUIStore();

  const handleRun = useCallback(async () => {
    const { activeTabPath: path, workspace: ws } = useFileStore.getState();
    if (!path) return;

    try {
      await useFileStore.getState().saveActiveFile();
    } catch {
      notify('Failed to save before run', 'error');
      return;
    }

    const config = getRunConfig(path, ws);
    if (!config) {
      const ext = path.split('.').pop()?.toLowerCase() ?? '';
      notify(`Running .${ext} files is not supported. Use the terminal`, 'error');
      return;
    }

    openBottom('terminal');

    const relDir = config.cwd.startsWith(ws + '/')
      ? config.cwd.substring(ws.length + 1)
      : (config.cwd === ws ? '.' : config.cwd);

    const terminalCommand = `cd "$WORKSPACE_DIR/${relDir}" && ${config.command}`;

    setTimeout(() => {
      const event = new CustomEvent('run-in-terminal', {
        detail: { command: terminalCommand }
      });
      window.dispatchEvent(event);
      notify(`Running in terminal`, 'success');
    }, 100);
  }, []);

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

  const activeTab = openTabs.find(t => t.path === activeTabPath);
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
