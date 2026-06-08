import { useEffect, useRef } from 'react';
import Editor, { useMonaco, OnMount } from '@monaco-editor/react';
import type * as MonacoType from 'monaco-editor';
import { useFileStore } from '../../stores/fileStore';
import { getLanguage } from '../../utils';

// Define the VS Code dark theme to match exactly
const CLOUD_IDE_THEME: MonacoType.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment',           foreground: '6A9955', fontStyle: 'italic' },
    { token: 'comment.line',      foreground: '6A9955', fontStyle: 'italic' },
    { token: 'comment.block',     foreground: '6A9955', fontStyle: 'italic' },
    { token: 'keyword',           foreground: '569CD6' },
    { token: 'keyword.control',   foreground: 'C586C0' },
    { token: 'keyword.operator',  foreground: '569CD6' },
    { token: 'string',            foreground: 'CE9178' },
    { token: 'string.escape',     foreground: 'D7BA7D' },
    { token: 'number',            foreground: 'B5CEA8' },
    { token: 'number.float',      foreground: 'B5CEA8' },
    { token: 'type',              foreground: '4EC9B0' },
    { token: 'class',             foreground: '4EC9B0' },
    { token: 'function',          foreground: 'DCDCAA' },
    { token: 'variable',          foreground: '9CDCFE' },
    { token: 'variable.predefined', foreground: '4FC1FF' },
    { token: 'constant',          foreground: '9CDCFE' },
    { token: 'identifier',        foreground: 'D4D4D4' },
    { token: 'operator',          foreground: 'D4D4D4' },
    { token: 'delimiter',         foreground: 'D4D4D4' },
    { token: 'tag',               foreground: '569CD6' },
    { token: 'attribute.name',    foreground: '9CDCFE' },
    { token: 'attribute.value',   foreground: 'CE9178' },
    { token: 'metatag',           foreground: '569CD6' },
    { token: 'key',               foreground: '9CDCFE' },
    { token: 'regexp',            foreground: 'D16969' },
    { token: 'decorator',         foreground: 'DCDCAA' },
  ],
  colors: {
    'editor.background':                   '#1e1e1e',
    'editor.foreground':                   '#d4d4d4',
    'editor.lineHighlightBackground':      '#2a2d2e',
    'editor.lineHighlightBorder':          '#2a2d2e',
    'editor.selectionBackground':          '#264f78',
    'editor.inactiveSelectionBackground':  '#3a3d41',
    'editor.findMatchBackground':          '#515c6a',
    'editor.findMatchHighlightBackground': '#ea5c004d',
    'editor.wordHighlightBackground':      '#575757b8',
    'editor.wordHighlightStrongBackground':'#004972b8',
    'editorCursor.foreground':             '#aeafad',
    'editorWhitespace.foreground':         '#3b3a32',
    'editorLineNumber.foreground':         '#858585',
    'editorLineNumber.activeForeground':   '#c6c6c6',
    'editorIndentGuide.background':        '#404040',
    'editorIndentGuide.activeBackground':  '#707070',
    'editorBracketMatch.background':       '#0064001a',
    'editorBracketMatch.border':           '#888888',
    'editorGutter.background':             '#1e1e1e',
    'editorWidget.background':             '#252526',
    'editorWidget.border':                 '#454545',
    'editorSuggestWidget.background':      '#252526',
    'editorSuggestWidget.border':          '#454545',
    'editorSuggestWidget.foreground':      '#d4d4d4',
    'editorSuggestWidget.selectedBackground':'#04395e',
    'editorSuggestWidget.highlightForeground':'#0097fb',
    'editorHoverWidget.background':        '#252526',
    'editorHoverWidget.border':            '#454545',
    'peekView.border':                     '#007acc',
    'peekViewEditor.background':           '#001f33',
    'peekViewResult.background':           '#252526',
    'debugToolBar.background':             '#333333',
    'diffEditor.insertedTextBackground':   '#9ccc2c33',
    'diffEditor.removedTextBackground':    '#ff000033',
    'scrollbar.shadow':                    '#000000',
    'scrollbarSlider.background':          '#79797966',
    'scrollbarSlider.hoverBackground':     '#646464b3',
    'scrollbarSlider.activeBackground':    '#bfbfbf66',
    'minimap.background':                  '#1e1e1e',
    'breadcrumb.background':               '#1e1e1e',
    'breadcrumb.foreground':               '#cccccccc',
    'breadcrumb.focusForeground':          '#e8e8e8',
  },
};

const EDITOR_OPTIONS: MonacoType.editor.IStandaloneEditorConstructionOptions = {
  fontSize: 14,
  fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', 'Menlo', monospace",
  fontLigatures: true,
  lineHeight: 22,
  letterSpacing: 0.5,
  minimap: { enabled: true, scale: 1, showSlider: 'mouseover' },
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
  wordWrap: 'off',
  lineNumbers: 'on',
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
  tabSize: 2,
  insertSpaces: true,
  detectIndentation: true,
  wordBasedSuggestions: 'matchingDocuments',
  parameterHints: { enabled: true, cycle: true },
  inlineSuggest: { enabled: true, mode: 'prefix' },
  accessibilitySupport: 'auto',
  mouseWheelZoom: true,
  stickyScroll: { enabled: true, maxLineCount: 5 },
  lightbulb: { enabled: 'on' as any },
  scrollbar: {
    useShadows: false,
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
    alwaysConsumeMouseWheel: false,
  },
  'semanticHighlighting.enabled': true,
} as MonacoType.editor.IStandaloneEditorConstructionOptions;

export function MonacoEditor() {
  const monacoHook = useMonaco();
  const { openTabs, activeTabPath, updateContent, saveFile } = useFileStore();
  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null);
  const modelsRef = useRef<Map<string, MonacoType.editor.ITextModel>>(new Map());

  const activeTab = openTabs.find(t => t.path === activeTabPath);

  // Register theme once
  useEffect(() => {
    if (!monacoHook) return;
    monacoHook.editor.defineTheme('cloud-ide-dark', CLOUD_IDE_THEME);
    monacoHook.editor.setTheme('cloud-ide-dark');
  }, [monacoHook]);

  // When active tab changes, swap models so each file has independent undo history
  useEffect(() => {
    if (!editorRef.current || !monacoHook || !activeTab) return;
    const editor = editorRef.current;

    let model = modelsRef.current.get(activeTab.path);
    if (!model || model.isDisposed()) {
      model = monacoHook.editor.createModel(
        activeTab.content,
        getLanguage(activeTab.name),
        monacoHook.Uri.parse(`file:///${activeTab.path}`),
      );
      modelsRef.current.set(activeTab.path, model);
    }

    if (editor.getModel() !== model) {
      editor.setModel(model);
    }
  }, [activeTabPath, monacoHook]);

  // Sync content from store into model (e.g. if loaded from API)
  useEffect(() => {
    if (!activeTab || !monacoHook) return;
    const model = modelsRef.current.get(activeTab.path);
    if (model && !model.isDisposed() && model.getValue() !== activeTab.content) {
      model.setValue(activeTab.content);
    }
  }, [activeTab?.content]);

  // Clean up disposed models when tabs close
  useEffect(() => {
    if (!monacoHook) return;
    const openPaths = new Set(openTabs.map(t => t.path));
    for (const [path, model] of modelsRef.current) {
      if (!openPaths.has(path)) {
        model.dispose();
        modelsRef.current.delete(path);
      }
    }
  }, [openTabs]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Ctrl/Cmd+S to save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const path = useFileStore.getState().activeTabPath;
      if (path) saveFile(path);
    });

    // Restore or create model for the current tab
    if (activeTab) {
      let model = modelsRef.current.get(activeTab.path);
      if (!model || model.isDisposed()) {
        model = monaco.editor.createModel(
          activeTab.content,
          getLanguage(activeTab.name),
          monaco.Uri.parse(`file:///${activeTab.path}`),
        );
        modelsRef.current.set(activeTab.path, model);
      }
      editor.setModel(model);
    }

    editor.focus();
  };

  // Track changes on the active model
  useEffect(() => {
    if (!monacoHook || !activeTab) return;
    const model = modelsRef.current.get(activeTab.path);
    if (!model) return;
    const disposable = model.onDidChangeContent(() => {
      updateContent(activeTab.path, model.getValue());
    });
    return () => disposable.dispose();
  }, [activeTabPath, monacoHook]);

  if (!activeTab) return null;

  return (
    <Editor
      height="100%"
      theme="cloud-ide-dark"
      language={getLanguage(activeTab.name)}
      defaultValue={activeTab.content}
      onMount={handleMount}
      options={EDITOR_OPTIONS}
      loading={
        <div className="flex items-center justify-center h-full bg-ide-bg text-ide-text-muted text-sm">
          Loading editor...
        </div>
      }
    />
  );
}
