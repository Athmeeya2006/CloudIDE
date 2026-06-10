import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, RotateCcw, Trash2, Send } from 'lucide-react';
import { useProcessStore } from '../../stores/processStore';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';
import { WS_BASE } from '../../api/client';
import { getStatusColor, cn } from '../../utils';

export function LogsPanel() {
  const { processes, activeProcessId, logsMap, fetchProcesses, runCommand, stopProcess, restartProcess, removeProcess, setActiveProcess, appendLog, clearLogs } = useProcessStore();
  const { workspace } = useFileStore();
  const { notify } = useUIStore();
  const [cmdInput, setCmdInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const logContainerRef = useRef<HTMLDivElement>(null);
  const activeWsRef = useRef<WebSocket | null>(null);

  // Fetch running processes on mount & clean up websocket
  useEffect(() => {
    fetchProcesses();
    return () => {
      activeWsRef.current?.close();
    };
  }, []);

  const activeProcess = processes.find(p => p.id === activeProcessId);

  // Manage WS logs stream for active process
  useEffect(() => {
    if (activeWsRef.current) {
      activeWsRef.current.close();
      activeWsRef.current = null;
    }

    if (!activeProcessId) return;

    // Reset store logs for active if missing
    clearLogs(activeProcessId);

    const wsUrl = `${WS_BASE.replace('http', 'ws')}/api/processes/${activeProcessId}/logs`;
    const ws = new WebSocket(wsUrl);
    activeWsRef.current = ws;

    ws.onmessage = (event) => {
      if (event.data === '\x00') return; // Keepalive
      appendLog(activeProcessId, event.data);
    };

    ws.onerror = () => {
      notify('Process logs stream error', 'error');
    };

    return () => {
      ws.close();
    };
  }, [activeProcessId, activeProcess?.os_pid]);

  // Scroll to bottom on new logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logsMap[activeProcessId || '']?.length]);

  const handleStartProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;

    const name = nameInput.trim() || cmdInput.trim().substring(0, 30);
    const cwd = workspace;

    try {
      const proc = await runCommand(cmdInput, cwd, name);
      setCmdInput('');
      setNameInput('');
      notify(`Process "${name}" started`, 'success');
    } catch (err) {
      notify('Failed to start process', 'error');
    }
  };

  return (
    <div className="h-full flex overflow-hidden bg-ide-terminal">
      {/* Sidebar List */}
      <div className="w-64 border-r border-ide-border flex flex-col shrink-0">
        <div className="p-2 border-b border-ide-border shrink-0">
          <form onSubmit={handleStartProcess} className="space-y-1.5">
            <input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Name (e.g. dev server)"
              className="w-full bg-ide-bg-lighter text-ide-text text-[11px] px-2 py-1 outline-none border border-ide-border focus:border-ide-accent"
            />
            <div className="flex gap-1">
              <input
                value={cmdInput}
                onChange={e => setCmdInput(e.target.value)}
                placeholder="Command (e.g. npm run dev)"
                className="flex-1 bg-ide-bg-lighter text-ide-text text-[11px] px-2 py-1 outline-none border border-ide-border focus:border-ide-accent"
              />
              <button
                type="submit"
                disabled={!cmdInput.trim()}
                className="px-2 bg-ide-accent hover:bg-[#1a8ad4] text-white rounded disabled:opacity-40"
              >
                <Send size={11} />
              </button>
            </div>
          </form>
        </div>

        {/* Process list */}
        <div className="flex-1 overflow-y-auto py-1">
          {processes.length === 0 ? (
            <div className="text-ide-text-dim text-[11px] p-3 text-center">
              No managed processes
            </div>
          ) : (
            processes.map(proc => {
              const isActive = proc.id === activeProcessId;
              return (
                <div
                  key={proc.id}
                  onClick={() => setActiveProcess(proc.id)}
                  className={cn(
                    'flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-ide-hover group transition-colors',
                    isActive && 'bg-[#2d2d2d]'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: getStatusColor(proc.status) }}
                    />
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-ide-text truncate">{proc.name}</div>
                      <div className="text-[10px] text-ide-text-dim font-mono truncate">{proc.command}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {proc.status === 'running' ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); stopProcess(proc.id); }}
                        className="p-0.5 hover:text-ide-red text-ide-text-dim"
                        title="Stop"
                      >
                        <Square size={10} fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); restartProcess(proc.id); }}
                        className="p-0.5 hover:text-ide-green text-ide-text-dim"
                        title="Restart"
                      >
                        <Play size={10} fill="currentColor" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeProcess(proc.id); }}
                      className="p-0.5 hover:text-ide-red text-ide-text-dim"
                      title="Remove"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Terminal Output / Logs viewer */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
        {activeProcess ? (
          <>
            {/* Toolbar */}
            <div className="h-8 bg-[#252526] px-3 flex items-center justify-between border-b border-ide-border shrink-0 select-none">
              <span className="text-[11px] font-mono text-ide-text-muted">
                Logs for: <span className="text-ide-text">{activeProcess.name}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => restartProcess(activeProcess.id)}
                  className="text-ide-text-dim hover:text-ide-text flex items-center gap-1 text-[11px] hover:bg-ide-hover px-2 py-0.5 rounded transition-colors"
                >
                  <RotateCcw size={10} /> Restart
                </button>
                <button
                  onClick={() => stopProcess(activeProcess.id)}
                  disabled={activeProcess.status !== 'running'}
                  className="text-ide-text-dim hover:text-ide-text disabled:opacity-40 flex items-center gap-1 text-[11px] hover:bg-ide-hover px-2 py-0.5 rounded transition-colors"
                >
                  <Square size={10} /> Terminate
                </button>
              </div>
            </div>

            {/* Logs box */}
            <div
              ref={logContainerRef}
              className="flex-1 p-3 font-mono text-[12px] leading-5 text-ide-text overflow-y-auto whitespace-pre-wrap select-text selection:bg-ide-selected"
            >
              {(logsMap[activeProcess.id] || []).length === 0 ? (
                <div className="text-ide-text-dim italic text-center py-4">No logs yet</div>
              ) : (
                logsMap[activeProcess.id].map((line, i) => (
                  <div key={i} className="hover:bg-white/5">{line.replace(/\n$/, '')}</div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-ide-text-dim text-xs select-none">
            Select or start a process to view output logs
          </div>
        )}
      </div>
    </div>
  );
}
