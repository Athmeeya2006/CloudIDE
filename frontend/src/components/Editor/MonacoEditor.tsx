import { useEffect, useRef } from 'react';
import Editor, { useMonaco, OnMount } from '@monaco-editor/react';
import type * as MonacoType from 'monaco-editor';
import { useFileStore } from '../../stores/fileStore';
import { useUIStore } from '../../stores/uiStore';
import { getLanguage } from '../../utils';
 
const CLOUD_IDE_THEME: MonacoType.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment',            foreground: '6A9955', fontStyle: 'italic' },
    { token: 'comment.line',       foreground: '6A9955', fontStyle: 'italic' },
    { token: 'comment.block',      foreground: '6A9955', fontStyle: 'italic' },
    { token: 'keyword',            foreground: '569CD6' },
    { token: 'keyword.control',    foreground: 'C586C0' },
    { token: 'keyword.operator',   foreground: '569CD6' },
    { token: 'string',             foreground: 'CE9178' },
    { token: 'string.escape',      foreground: 'D7BA7D' },
    { token: 'number',             foreground: 'B5CEA8' },
    { token: 'type',               foreground: '4EC9B0' },
    { token: 'class',              foreground: '4EC9B0' },
    { token: 'function',           foreground: 'DCDCAA' },
    { token: 'variable',           foreground: '9CDCFE' },
    { token: 'variable.predefined',foreground: '4FC1FF' },
    { token: 'constant',           foreground: '9CDCFE' },
    { token: 'identifier',         foreground: 'D4D4D4' },
    { token: 'operator',           foreground: 'D4D4D4' },
    { token: 'delimiter',          foreground: 'D4D4D4' },
    { token: 'tag',                foreground: '569CD6' },
    { token: 'attribute.name',     foreground: '9CDCFE' },
    { token: 'attribute.value',    foreground: 'CE9178' },
    { token: 'regexp',             foreground: 'D16969' },
    { token: 'decorator',          foreground: 'DCDCAA' },
  ],
  colors: {
    'editor.background':                    '#1e1e1e',
    'editor.foreground':                    '#d4d4d4',
    'editor.lineHighlightBackground':       '#2a2d2e',
    'editor.lineHighlightBorder':           '#2a2d2e',
    'editor.selectionBackground':           '#264f78',
    'editor.inactiveSelectionBackground':   '#3a3d41',
    'editor.findMatchBackground':           '#515c6a',
    'editor.findMatchHighlightBackground':  '#ea5c004d',
    'editor.wordHighlightBackground':       '#575757b8',
    'editorCursor.foreground':              '#aeafad',
    'editorLineNumber.foreground':          '#858585',
    'editorLineNumber.activeForeground':    '#c6c6c6',
    'editorIndentGuide.background1':        '#404040',
    'editorIndentGuide.activeBackground1':  '#707070',
    'editorBracketMatch.background':        '#0064001a',
    'editorBracketMatch.border':            '#888888',
    'editorGutter.background':              '#1e1e1e',
    'editorWidget.background':              '#252526',
    'editorWidget.border':                  '#454545',
    'editorSuggestWidget.background':       '#252526',
    'editorSuggestWidget.border':           '#454545',
    'editorSuggestWidget.foreground':       '#d4d4d4',
    'editorSuggestWidget.selectedBackground':'#04395e',
    'editorHoverWidget.background':         '#252526',
    'editorHoverWidget.border':             '#454545',
    'scrollbarSlider.background':           '#79797966',
    'scrollbarSlider.hoverBackground':      '#646464b3',
    'scrollbarSlider.activeBackground':     '#bfbfbf66',
    'minimap.background':                   '#1e1e1e',
  },
};
 
function buildEditorOptions(
  settings: { fontSize: number; tabSize: number; wordWrap: boolean; minimap: boolean; lineNumbers: boolean },
): MonacoType.editor.IStandaloneEditorConstructionOptions {
  return {
    fontSize: settings.fontSize,
    fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', Menlo, monospace",
    fontLigatures: true,
    lineHeight: Math.round(settings.fontSize * 1.6),
    letterSpacing: 0.3,
    minimap: { enabled: settings.minimap, scale: 1, showSlider: 'mouseover' },
    wordWrap: settings.wordWrap ? 'on' : 'off',
    lineNumbers: settings.lineNumbers ? 'on' : 'off',
    tabSize: settings.tabSize,
    insertSpaces: true,
    detectIndentation: true,
    scrollBeyondLastLine: false,
    renderWhitespace: 'selection',
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      bracketPairsHorizontal: true,
      highlightActiveBracketPair: true,
      indentation: true,
      highlightActiveIndentation: true,
    },
    suggest: {
      showKeywords: true,
      showSnippets: true,
      insertMode: 'replace',
      preview: true,
    },
    quickSuggestions: { other: true, comments: false, strings: false },
    glyphMargin: true,
    folding: true,
    foldingStrategy: 'indentation',
    showFoldingControls: 'mouseover',
    lineDecorationsWidth: 10,
    padding: { top: 8, bottom: 8 },
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    renderLineHighlight: 'all',
    occurrencesHighlight: 'multiFile',
    selectionHighlight: true,
    roundedSelection: false,
    multiCursorModifier: 'ctrlCmd',
    formatOnPaste: true,
    formatOnType: false,
    autoIndent: 'full',
    wordBasedSuggestions: 'matchingDocuments',
    parameterHints: { enabled: true, cycle: true },
    inlineSuggest: { enabled: true, mode: 'prefix' },
    accessibilitySupport: 'auto',
    mouseWheelZoom: true,
    stickyScroll: { enabled: true, maxLineCount: 5 },
    colorDecorators: true,
    lightbulb: { enabled: 'onCode' as MonacoType.editor.ShowLightbulbIconMode },
    hover: { enabled: true, delay: 300 },
    scrollbar: {
      useShadows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
      alwaysConsumeMouseWheel: false,
    },
    'semanticHighlighting.enabled': true,
  } as MonacoType.editor.IStandaloneEditorConstructionOptions;
}
 
export function MonacoEditor() {
  const monacoHook = useMonaco();
  const { openTabs, activeTabPath, updateContent } = useFileStore();
  const { editorSettings } = useUIStore();
  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null);
  const modelsRef = useRef<Map<string, MonacoType.editor.ITextModel>>(new Map());
  const lastStoreContentRef = useRef<string>('');
 
  const activeTab = openTabs.find(t => t.path === activeTabPath);
 
  // Apply editor settings live
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.updateOptions(buildEditorOptions(editorSettings));
  }, [editorSettings]);
 
  // Register theme once
  useEffect(() => {
    if (!monacoHook) return;
    monacoHook.editor.defineTheme('cloud-ide-dark', CLOUD_IDE_THEME);
    monacoHook.editor.setTheme('cloud-ide-dark');
  }, [monacoHook]);
 
  // Swap models when active tab changes: preserves independent undo stack per file
  useEffect(() => {
    if (!editorRef.current || !monacoHook || !activeTab) return;
    const editor = editorRef.current;
 
    let model = modelsRef.current.get(activeTab.path);
    if (!model || model.isDisposed()) {
      model = monacoHook.editor.createModel(
        activeTab.content,
        getLanguage(activeTab.name),
        monacoHook.Uri.file(activeTab.path),
      );
      modelsRef.current.set(activeTab.path, model);
      lastStoreContentRef.current = activeTab.content;
    }
    if (editor.getModel() !== model) {
      editor.setModel(model);
      lastStoreContentRef.current = model.getValue();
    }
    // Keyed on the active path; reading the matching tab from the closure is
    // intentional so a content edit doesn't re-swap the model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabPath, monacoHook]);
 
  // Sync external content changes (e.g. git pull) into the editor model
  useEffect(() => {
    if (!activeTab || !monacoHook) return;
    const model = modelsRef.current.get(activeTab.path);
    if (model && !model.isDisposed() && activeTab.content !== lastStoreContentRef.current) {
      lastStoreContentRef.current = activeTab.content;
      // Use pushEditOperations to keep undo history intact for external edits
      const fullRange = model.getFullModelRange();
      model.pushEditOperations(
        [],
        [{ range: fullRange, text: activeTab.content }],
        () => null,
      );
    }
    // Runs on external content changes; the active tab is resolved from state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.content, monacoHook]);
 
  // Dispose models for closed tabs
  useEffect(() => {
    if (!monacoHook) return;
    const openPaths = new Set(openTabs.map(t => t.path));
    for (const [path, model] of modelsRef.current) {
      if (!openPaths.has(path)) {
        model.dispose();
        modelsRef.current.delete(path);
      }
    }
  }, [openTabs, monacoHook]);
 
  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
 
    monaco.editor.defineTheme('cloud-ide-dark', CLOUD_IDE_THEME);
    monaco.editor.setTheme('cloud-ide-dark');
 
    // Ctrl/Cmd+S: save and optionally format
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
      const state = useFileStore.getState();
      const uiState = useUIStore.getState();
      if (state.activeTabPath) {
        if (uiState.editorSettings.formatOnSave) {
          await editor.getAction('editor.action.formatDocument')?.run();
        }
        state.saveFile(state.activeTabPath);
      }
    });
 
    // Restore or create initial model
    if (activeTab) {
      let model = modelsRef.current.get(activeTab.path);
      if (!model || model.isDisposed()) {
        model = monaco.editor.createModel(
          activeTab.content,
          getLanguage(activeTab.name),
          monaco.Uri.file(activeTab.path),
        );
        modelsRef.current.set(activeTab.path, model);
        lastStoreContentRef.current = activeTab.content;
      }
      editor.setModel(model);
    }
 
    // Apply current settings
    editor.updateOptions(buildEditorOptions(useUIStore.getState().editorSettings));
 
    editor.focus();
  };
 
  // Track content changes from active model to store
  useEffect(() => {
    if (!monacoHook || !activeTab) return;
    const model = modelsRef.current.get(activeTab.path);
    if (!model) return;
    const disposable = model.onDidChangeContent(() => {
      const value = model.getValue();
      lastStoreContentRef.current = value;
      updateContent(activeTab.path, value);
    });
    return () => disposable.dispose();
    // Re-attach the change listener only when the active tab changes; attaching
    // it per keystroke (via activeTab/updateContent deps) would be wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabPath, monacoHook]);
 
  if (!activeTab) return null;
 
  return (
    <Editor
      height="100%"
      theme="cloud-ide-dark"
      onMount={handleMount}
      options={buildEditorOptions(editorSettings)}
      loading={
        <div className="flex items-center justify-center h-full bg-ide-bg text-ide-text-muted text-sm gap-2">
          <svg className="animate-spin h-4 w-4 text-ide-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading editor...
        </div>
      }
    />
  );
}
