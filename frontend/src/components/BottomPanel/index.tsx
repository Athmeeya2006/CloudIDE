import React from 'react';
import { ChevronDown, TerminalSquare, Activity, Database } from 'lucide-react';
import { TerminalPanel } from './TerminalPanel';
import { LogsPanel } from './LogsPanel';
import { DatabaseViewer } from './DatabaseViewer';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../utils';
import type { BottomView } from '../../types';

interface TabItem {
  id: BottomView;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabItem[] = [
  { id: 'terminal',   label: 'Terminal',          icon: <TerminalSquare size={12} /> },
  { id: 'logs',       label: 'Processes',         icon: <Activity size={12} /> },
  { id: 'db-viewer',  label: 'Database',          icon: <Database size={12} /> },
];

export function BottomPanel() {
  const { bottomView, setBottomView, toggleBottom } = useUIStore();

  return (
    <div className="h-full flex flex-col bg-ide-terminal border-t border-ide-border overflow-hidden">
      {/* Tab bar */}
      <div className="h-9 bg-[#252526] flex items-center justify-between border-b border-ide-border shrink-0 select-none">
        <div className="flex items-center h-full">
          {TABS.map(tab => {
            const isActive = bottomView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setBottomView(tab.id)}
                className={cn(
                  'h-full px-4 flex items-center gap-1.5 text-[12px] font-medium transition-colors border-b-2',
                  isActive
                    ? 'text-ide-text border-b-ide-accent bg-ide-terminal'
                    : 'text-ide-text-dim border-b-transparent hover:text-ide-text hover:bg-[#2d2d2d]',
                )}
              >
                <span className={cn('transition-colors', isActive ? 'text-ide-accent' : '')}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={toggleBottom}
          title="Minimize panel (Ctrl+`)"
          className="mr-2 p-1.5 text-ide-text-dim hover:text-ide-text hover:bg-ide-hover rounded transition-colors"
          aria-label="Minimize panel"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Always mount terminal so session persists across tab switches */}
        <div className={cn('absolute inset-0', bottomView !== 'terminal' && 'invisible pointer-events-none')}>
          <TerminalPanel />
        </div>
        {bottomView === 'logs' && (
          <div className="absolute inset-0">
            <LogsPanel />
          </div>
        )}
        {bottomView === 'db-viewer' && (
          <div className="absolute inset-0">
            <DatabaseViewer />
          </div>
        )}
      </div>
    </div>
  );
}
