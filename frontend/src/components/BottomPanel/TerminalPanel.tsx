import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WS_BASE } from '../../api/client';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';
import '@xterm/xterm/css/xterm.css';

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { workspace } = useFileStore();
  const { notify } = useUIStore();
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize xterm
    const term = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#007fd4',
        selectionBackground: 'rgba(9, 71, 113, 0.5)',
        black: '#000000',
        red: '#f44747',
        green: '#4ec9b0',
        yellow: '#dcdcaa',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#cccccc',
      },
      fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 1000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Open WS connection
    const wsUrl = `${WS_BASE.replace('http', 'ws')}/api/terminal/ws/${sessionId}?cwd=/home/athmeeya/CloudIDE/workspaces/${workspace}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send initial dimensions
      const dims = {
        type: 'resize',
        rows: term.rows,
        cols: term.cols,
      };
      ws.send(JSON.stringify(dims));
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result) {
            term.write(new Uint8Array(reader.result as ArrayBuffer));
          }
        };
        reader.readAsArrayBuffer(event.data);
      }
    };

    ws.onerror = () => {
      notify('Terminal WebSocket connection error', 'error');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    const handleResize = () => {
      try {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'resize',
              rows: term.rows,
              cols: term.cols,
            })
          );
        }
      } catch (err) {
        // Ignored
      }
    };

    // Watch resize
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, [workspace, sessionId]);

  return (
    <div className="w-full h-full p-2 bg-[#1e1e1e] overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
