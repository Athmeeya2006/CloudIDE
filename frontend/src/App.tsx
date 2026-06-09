import { useEffect } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { ActivityBar } from './components/ActivityBar';
import { Sidebar } from './components/Sidebar';
import { EditorArea } from './components/Editor/EditorArea';
import { BottomPanel } from './components/BottomPanel';
import { StatusBar } from './components/StatusBar';
import { PreviewPanel } from './components/Preview';
import { Notification } from './components/Notification';
import { CloneDialog } from './components/Modals/CloneDialog';
import { NewFileDialog } from './components/Modals/NewFileDialog';
import { useFileStore } from './stores/fileStore';
import { useUIStore } from './stores/uiStore';
import { useHotkeys } from 'react-hotkeys-hook';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const { refreshTree, saveActiveFile } = useFileStore();
  const { sidebarOpen, bottomOpen, previewOpen, openBottom, toggleBottom } = useUIStore();

  useEffect(() => {
    refreshTree();
  }, []);

  // Global hotkeys
  useHotkeys('ctrl+s, meta+s', (e) => {
    e.preventDefault();
    saveActiveFile();
  }, { enableOnContentEditable: true, enableOnFormTags: true });

  useHotkeys('ctrl+`', (e) => {
    e.preventDefault();
    toggleBottom();
    openBottom('terminal');
  });

  return (
    <div className="flex flex-col h-screen bg-ide-bg text-ide-text select-none overflow-hidden">
      {/* Top title bar */}
      <div className="h-8 bg-[#323233] flex items-center justify-between px-4 shrink-0 border-b border-ide-border">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-ide-text-muted tracking-widest uppercase">Cloud IDE</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-ide-text-muted">
          <button
            onClick={() => openBottom('terminal')}
            className="hover:text-ide-text transition-colors px-1"
          >
            Terminal
          </button>
          <button
            onClick={() => openBottom('logs')}
            className="hover:text-ide-text transition-colors px-1"
          >
            Logs
          </button>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />

        <PanelGroup direction="horizontal" className="flex-1">
          {sidebarOpen && (
            <>
              <Panel
                id="sidebar"
                defaultSize={22}
                minSize={15}
                maxSize={45}
                className="flex flex-col bg-ide-sidebar border-r border-ide-border"
              >
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="w-[3px] bg-ide-border hover:bg-ide-accent transition-colors cursor-col-resize" />
            </>
          )}

          <Panel id="main" defaultSize={sidebarOpen ? 78 : 100}>
            <PanelGroup direction="horizontal">
              <Panel id="editor" defaultSize={previewOpen ? 60 : 100}>
                <PanelGroup direction="vertical">
                  <Panel id="editor-area" defaultSize={bottomOpen ? 65 : 100} minSize={20}>
                    <ErrorBoundary>
                      <EditorArea />
                    </ErrorBoundary>
                  </Panel>

                  {bottomOpen && (
                    <>
                      <PanelResizeHandle className="h-[3px] bg-ide-border hover:bg-ide-accent transition-colors cursor-row-resize" />
                      <Panel id="bottom" defaultSize={35} minSize={15} maxSize={70}>
                        <ErrorBoundary>
                          <BottomPanel />
                        </ErrorBoundary>
                      </Panel>
                    </>
                  )}
                </PanelGroup>
              </Panel>

              {previewOpen && (
                <>
                  <PanelResizeHandle className="w-[3px] bg-ide-border hover:bg-ide-accent transition-colors cursor-col-resize" />
                  <Panel id="preview" defaultSize={40} minSize={20}>
                    <PreviewPanel />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      <StatusBar />

      {/* Overlays */}
      <Notification />
      <CloneDialog />
      <NewFileDialog />
    </div>
  );
}
