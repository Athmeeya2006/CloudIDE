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
import { QuickOpenDialog } from './components/Modals/QuickOpenDialog';
import { SettingsDialog } from './components/Modals/SettingsDialog';
import { useFileStore } from './stores/fileStore';
import { useUIStore } from './stores/uiStore';
import { useHotkeys } from 'react-hotkeys-hook';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const { refreshTree, saveActiveFile } = useFileStore();
  const {
    sidebarOpen, bottomOpen, previewOpen,
    openBottom, toggleBottom, openQuickOpen,
    openSettings, openSidebar,
  } = useUIStore();

  useEffect(() => {
    refreshTree();
  }, []);

  // Save
  useHotkeys('ctrl+s, meta+s', (e) => {
    e.preventDefault();
    saveActiveFile();
  }, { enableOnContentEditable: true, enableOnFormTags: true });

  // Toggle terminal
  useHotkeys('ctrl+`', (e) => {
    e.preventDefault();
    toggleBottom();
    openBottom('terminal');
  }, { enableOnFormTags: true });

  // Quick open (Ctrl+P)
  useHotkeys('ctrl+p, meta+p', (e) => {
    e.preventDefault();
    openQuickOpen();
  }, { enableOnFormTags: true });

  // Explorer sidebar
  useHotkeys('ctrl+shift+e', (e) => {
    e.preventDefault();
    openSidebar('explorer');
  }, { enableOnFormTags: true });

  // Search sidebar
  useHotkeys('ctrl+shift+f', (e) => {
    e.preventDefault();
    openSidebar('search');
  }, { enableOnFormTags: true });

  // Settings
  useHotkeys('ctrl+comma, meta+comma', (e) => {
    e.preventDefault();
    openSettings();
  }, { enableOnFormTags: true });

  return (
    <div className="flex flex-col h-screen bg-ide-bg text-ide-text select-none overflow-hidden">
      {/* Title bar */}
      <div className="h-8 bg-[#323233] flex items-center justify-between px-4 shrink-0 border-b border-ide-border">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 32 32" fill="none" className="shrink-0">
            <rect width="32" height="32" rx="4" fill="#007acc"/>
            <path d="M8 10l8 6-8 6V10z" fill="white"/>
            <rect x="18" y="20" width="8" height="2" rx="1" fill="white"/>
          </svg>
          <span className="text-[11px] font-medium text-ide-text-muted tracking-widest uppercase">Cloud IDE</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-ide-text-muted">
          <button
            onClick={() => { openBottom('terminal'); }}
            className="hover:text-ide-text transition-colors px-2 py-1 hover:bg-ide-hover rounded"
          >
            Terminal
          </button>
          <button
            onClick={() => openBottom('logs')}
            className="hover:text-ide-text transition-colors px-2 py-1 hover:bg-ide-hover rounded"
          >
            Processes
          </button>
          <button
            onClick={openQuickOpen}
            className="hover:text-ide-text transition-colors px-2 py-1 hover:bg-ide-hover rounded hidden sm:block"
          >
            Go to File
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
                minSize={14}
                maxSize={45}
                className="flex flex-col bg-ide-sidebar border-r border-ide-border"
              >
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="w-[3px] bg-transparent hover:bg-ide-accent/60 active:bg-ide-accent transition-colors cursor-col-resize" />
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
                      <PanelResizeHandle className="h-[3px] bg-transparent hover:bg-ide-accent/60 active:bg-ide-accent transition-colors cursor-row-resize" />
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
                  <PanelResizeHandle className="w-[3px] bg-transparent hover:bg-ide-accent/60 active:bg-ide-accent transition-colors cursor-col-resize" />
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
      <QuickOpenDialog />
      <SettingsDialog />
    </div>
  );
}
