import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WS_BASE } from '../../api/client';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';
import '@xterm/xterm/css/xterm.css';
 
export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef      = useRef<Terminal | null>(null);
  const wsRef        = useRef<WebSocket | null>(null);
  const fitAddonRef  = useRef<FitAddon | null>(null);
  const { workspace } = useFileStore();
  const { notify }    = useUIStore();
  const [sessionId]   = useState(() => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
  const [connected, setConnected] = useState(false);
 
  useEffect(() => {
    if (!containerRef.current) return;
 
    const term = new Terminal({
      theme: {
        background:          '#1e1e1e',
        foreground:          '#cccccc',
        cursor:              '#007fd4',
        cursorAccent:        '#1e1e1e',
        selectionBackground: 'rgba(9, 71, 113, 0.6)',
        black:   '#000000', brightBlack:   '#666666',
        red:     '#f44747', brightRed:     '#f44747',
        green:   '#4ec9b0', brightGreen:   '#4ec9b0',
        yellow:  '#dcdcaa', brightYellow:  '#dcdcaa',
        blue:    '#569cd6', brightBlue:    '#569cd6',
        magenta: '#c586c0', brightMagenta: '#c586c0',
        cyan:    '#4ec9b0', brightCyan:    '#9cdcfe',
        white:   '#cccccc', brightWhite:   '#ffffff',
      },
      fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      allowProposedApi: true,
    });
 
    const fitAddon     = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicodeAddon  = new Unicode11Addon();
 
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(unicodeAddon);
    term.unicode.activeVersion = '11';
 
    term.open(containerRef.current);
    setTimeout(() => { try { fitAddon.fit(); } catch {} }, 50);
 
    termRef.current     = term;
    fitAddonRef.current = fitAddon;
 
    const wsUrl = `${WS_BASE}/api/terminal/ws/${sessionId}?cwd=${encodeURIComponent(workspace)}`;
    const ws    = new WebSocket(wsUrl);
    wsRef.current = ws;
 
    ws.binaryType = 'arraybuffer';
 
    ws.onopen = () => {
      setConnected(true);
      try {
        fitAddon.fit();
        ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }));
      } catch {}
    };
 
    ws.onclose = () => { setConnected(false); };
 
    ws.onerror = () => {
      notify('Terminal connection error. Is the backend running?', 'error');
      setConnected(false);
    };
 
    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data));
      } else if (typeof event.data === 'string') {
        term.write(event.data);
      }
    };
 
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });
 
    const sendResize = () => {
      try {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }));
        }
      } catch {}
    };
 
    const ro = new ResizeObserver(() => sendResize());
    if (containerRef.current) ro.observe(containerRef.current);
 
    const handleRunInTerminal = (e: Event) => {
      const cmd = (e as CustomEvent).detail?.command;
      if (cmd && ws.readyState === WebSocket.OPEN) {
        ws.send('\x03');
        setTimeout(() => {
          ws.send(cmd + '\r');
        }, 150);
      }
    };
    window.addEventListener('run-in-terminal', handleRunInTerminal);
 
    return () => {
      ro.disconnect();
      window.removeEventListener('run-in-terminal', handleRunInTerminal);
      ws.close();
      term.dispose();
    };
  }, [workspace, sessionId]);
 
  return (
    <div className="w-full h-full flex flex-col bg-[#1e1e1e] overflow-hidden">
      {!connected && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-300 text-[11px] shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          Connecting to terminal…
        </div>
      )}
      <div ref={containerRef} className="flex-1 p-2 overflow-hidden" />
    </div>
  );
}
