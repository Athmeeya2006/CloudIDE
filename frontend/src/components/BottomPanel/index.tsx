import React from 'react';
import { TerminalPanel } from './TerminalPanel';
import { LogsPanel } from './LogsPanel';
import { DatabaseViewer } from './DatabaseViewer';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../utils';
import type { BottomView } from '../../types';

interface TabItem {
  id: BottomView;
  label: string;
}

const TABS: TabItem[] = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'logs', label: 'Processes' },
  { id: 'db-viewer', label: 'Database Viewer' },
];

export function BottomPanel() {
  const { bottomView, setBottomView, toggleBottom } = useUIStore();

  return (
    <div className="h-full flex flex-col bg-ide-terminal border-t border-ide-border overflow-hidden">
      {/* Header Tabs */}
      <div className="h-8 bg-ide-bg-light flex items-center justify-between px-3 border-b border-ide-border shrink-0 select-none">
        <div className="flex items-center gap-1 h-full">
          {TABS.map(tab => {
            const isActive = bottomView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setBottomView(tab.id)}
                className={cn(
                  'h-full px-3 text-[11px] font-medium transition-colors border-b-2',
                  isActive
                    ? 'text-ide-text border-b-ide-accent bg-ide-terminal'
                    : 'text-ide-text-dim border-b-transparent hover:text-ide-text hover:bg-ide-hover',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        
        {/* Actions / Close button */}
        <button
          onClick={toggleBottom}
          className="text-ide-text-dim hover:text-ide-text p-1 rounded hover:bg-ide-hover transition-colors"
          title="Minimize Panel"
        >
          ⌄
        </button>
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-hidden relative">
        {bottomView === 'terminal' && <TerminalPanel />}
        {bottomView === 'logs' && <LogsPanel />}
        {bottomView === 'db-viewer' && <DatabaseViewer />}
      </div>
    </div>
  );
}
