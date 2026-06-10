import { useEffect } from 'react';
import { EditorTabs } from './EditorTabs';
import { MonacoEditor } from './MonacoEditor';
import { useFileStore } from '../../stores/fileStore';
import { useProcessStore } from '../../stores/processStore';
import { useUIStore } from '../../stores/uiStore';
import { Play } from 'lucide-react';

export function EditorArea() {
  const { openTabs, activeTabPath, workspace, saveActiveFile } = useFileStore();
  const { runCommand } = useProcessStore();
  const { openBottom, notify } = useUIStore();

  const handleRun = async () => {
    if (!activeTabPath) return;

    // Auto-save the active file before running to ensure disk is in sync
    try {
      await saveActiveFile();
    } catch (err) {
      notify('Failed to save file before running', 'error');
    }

    openBottom('logs');

    const parts = activeTabPath.split('/');
    const filename = parts[parts.length - 1];
    const fileDir = parts.slice(0, -1).join('/') || workspace;
    const ext = filename.split('.').pop()?.toLowerCase();

    let command = '';
    let displayName = '';

    if (filename === 'manage.py') {
      command = 'python manage.py runserver 0.0.0.0:8001';
      displayName = 'Django Server';
    } else if (ext === 'py') {
      command = `python3 -u "${filename}"`;
      displayName = `Python: ${filename}`;
    } else if (ext === 'cpp' || ext === 'cc') {
      const out = filename.substring(0, filename.lastIndexOf('.')) || 'app';
      command = `g++ -Wall -O3 -o "${out}" "${filename}" && "./${out}"`;
      displayName = `C++: ${filename}`;
    } else if (ext === 'c') {
      const out = filename.substring(0, filename.lastIndexOf('.')) || 'app';
      command = `gcc -Wall -O3 -o "${out}" "${filename}" && "./${out}"`;
      displayName = `C: ${filename}`;
    } else if (ext === 'js') {
      command = `node "${filename}"`;
      displayName = `Node: ${filename}`;
    } else if (ext === 'go') {
      command = `go run "${filename}"`;
      displayName = `Go: ${filename}`;
    } else if (ext === 'rs') {
      const out = filename.substring(0, filename.lastIndexOf('.')) || 'app';
      command = `rustc "${filename}" && "./${out}"`;
      displayName = `Rust: ${filename}`;
    } else if (ext === 'sh' || ext === 'bash') {
      command = `bash "${filename}"`;
      displayName = `Shell: ${filename}`;
    } else {
      notify(`Running .${ext} files is not supported. Please use the terminal.`, 'error');
      return;
    }

    try {
      await runCommand(command, fileDir, displayName);
      notify(`${displayName} started`, 'success');
    } catch {
      notify(`Failed to run ${filename}`, 'error');
    }
  };

  // Global F5 key listener to compile/run code (like VS Code)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTabPath, workspace]);

  return (
    <div className="h-full flex flex-col bg-ide-bg overflow-hidden">
      {/* Toolbar */}
      {openTabs.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1 bg-[#252526] border-b border-ide-border shrink-0">
          <Breadcrumb />
          <div className="flex items-center gap-1">
            <button
              onClick={handleRun}
              title="Run Server (F5)"
              className="flex items-center gap-1 px-2 py-0.5 text-[12px] bg-[#1a8a3c] hover:bg-[#1fa846] text-white rounded transition-colors"
            >
              <Play size={11} fill="white" />
              <span>Run</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <EditorTabs />

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {openTabs.length === 0 ? (
          <WelcomeScreen />
        ) : (
          <MonacoEditor />
        )}
      </div>
    </div>
  );
}

function Breadcrumb() {
  const { activeTabPath } = useFileStore();
  if (!activeTabPath) return null;
  const parts = activeTabPath.split('/').filter(Boolean);
  return (
    <div className="flex items-center gap-0.5 text-[12px] text-ide-text-muted overflow-hidden">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <span className="text-ide-text-dim">/</span>}
          <span className={i === parts.length - 1 ? 'text-ide-text' : 'hover:text-ide-text cursor-pointer truncate max-w-[120px]'}>
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}

function WelcomeScreen() {
  const { openCloneDialog } = useUIStore();
  return (
    <div className="h-full flex flex-col items-center justify-center text-ide-text-muted">
      <div className="text-[64px] mb-6 opacity-10 select-none">⬡</div>
      <div className="text-xl font-light text-ide-text mb-2">Cloud IDE</div>
      <div className="text-[13px] opacity-60 mb-10">Full-stack dev environment in your browser</div>

      <div className="grid grid-cols-2 gap-2 text-[12px] w-[340px]">
        {[
          ['Ctrl+P', 'Quick Open File'],
          ['Ctrl+`', 'Toggle Terminal'],
          ['Ctrl+S', 'Save File'],
          ['F5', 'Run Server'],
          ['Ctrl+Shift+E', 'File Explorer'],
          ['Ctrl+Shift+F', 'Search Files'],
        ].map(([key, label]) => (
          <div key={key} className="flex items-center gap-2 bg-[#252526] border border-ide-border px-3 py-2 rounded">
            <kbd className="text-ide-accent font-mono text-[11px]">{key}</kbd>
            <span className="text-ide-text-dim">{label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={openCloneDialog}
        className="mt-8 px-4 py-2 bg-ide-accent hover:bg-[#1a8ad4] text-white text-[13px] rounded transition-colors"
      >
        Clone a Repository
      </button>
    </div>
  );
}
