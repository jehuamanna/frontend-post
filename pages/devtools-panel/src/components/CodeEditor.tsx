import React, { useMemo } from 'react';
import Editor from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import * as MonacoAPI from 'monaco-editor/esm/vs/editor/editor.api';
// Register editor contributions for word navigation commands
// These side-effect imports ensure commands like 'cursorWordLeft/Right' are available
import 'monaco-editor/esm/vs/editor/contrib/wordOperations/browser/wordOperations';
import 'monaco-editor/esm/vs/editor/contrib/wordPartOperations/browser/wordPartOperations';
// Register language tokenizers/contributions to enable syntax colors
// Import worker asset URLs (no blob:) and construct Workers manually to satisfy CSP
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import editorWorkerUrl from 'monaco-editor/esm/vs/editor/editor.worker?worker&url';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import jsonWorkerUrl from 'monaco-editor/esm/vs/language/json/json.worker?worker&url';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cssWorkerUrl from 'monaco-editor/esm/vs/language/css/css.worker?worker&url';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import htmlWorkerUrl from 'monaco-editor/esm/vs/language/html/html.worker?worker&url';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import tsWorkerUrl from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&url';

// Ensure Monaco workers are loaded from the app bundle (CSP-safe for extensions)
// Do this once at module load
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'json') return new Worker(jsonWorkerUrl as string, { type: 'module' });
    if (label === 'css' || label === 'scss' || label === 'less') return new Worker(cssWorkerUrl as string, { type: 'module' });
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new Worker(htmlWorkerUrl as string, { type: 'module' });
    if (label === 'typescript' || label === 'javascript') return new Worker(tsWorkerUrl as string, { type: 'module' });
    return new Worker(editorWorkerUrl as string, { type: 'module' });
  },
};

// Provide ESM monaco instance globally so the React wrapper can use it directly (no AMD loader)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (!(self as any).monaco) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  (self as any).monaco = MonacoAPI;
}


interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  language?: string;
  height?: string | number;
  className?: string;
  onCtrlEnter?: () => void;
  readOnly?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, language = 'plaintext', height = '100%', className = '', onCtrlEnter, readOnly = false }) => {
  const memoHeight = useMemo(() => (typeof height === 'number' ? `${height}px` : height), [height]);
  // Normalize language ids to Monaco's registered languages
  const normalizedLanguage = useMemo(() => {
    if (language === 'bash') return 'shell';
    return language;
  }, [language]);

  const handleMount = (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
  ) => {
    // Ctrl/Cmd + Enter to trigger callback if provided
    if (onCtrlEnter) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onCtrlEnter();
      });
    }

    // TEMP: Log keydown events to diagnose missing lowercase input (e.g., 'a'/'h')
    try {
      editor.onKeyDown(e => {
        const evt = e.browserEvent as KeyboardEvent;
        // Keep log concise to avoid noisy console
        // Example: key="a" code="KeyA" ctrl=false shift=false alt=false meta=false
        // Note: Remove this after diagnosis
        // eslint-disable-next-line no-console
        console.debug(
          '[CodeEditor] keydown',
          `key="${evt.key}"`,
          `code="${evt.code}"`,
          `ctrl=${!!evt.ctrlKey}`,
          `shift=${!!evt.shiftKey}`,
          `alt=${!!evt.altKey}`,
          `meta=${!!evt.metaKey}`,
        );
      });
    } catch {}

    // TEMP: Log content changes Monaco applies
    try {
      editor.onDidChangeModelContent(ev => {
        // eslint-disable-next-line no-console
        console.debug('[CodeEditor] onDidChangeModelContent changes=', ev.changes.map(c => ({ text: c.text, range: c.range })));
      });
    } catch {}

    // TEMP WORKAROUND: Intercept plain 'a' and 'h' and force-insert via executeEdits
    try {
      editor.onKeyDown(e => {
        const evt = e.browserEvent as KeyboardEvent;
        if (evt.ctrlKey || evt.metaKey || evt.altKey || evt.shiftKey) return;
        if (evt.code === 'KeyA' || evt.code === 'KeyH') {
          // Prevent default handling and force-insert
          e.preventDefault();
          const model = editor.getModel();
          const sel = editor.getSelection();
          if (!model || !sel) return;
          const ch = evt.code === 'KeyA' ? 'a' : 'h';
          // eslint-disable-next-line no-console
          console.debug('[CodeEditor] Force executeEdits insert for', ch);
          editor.executeEdits('force-insert', [
            {
              range: sel,
              text: ch,
              forceMoveMarkers: true,
            },
          ]);
          // Move cursor to after inserted char
          const end = editor.getSelection();
          if (end) editor.revealPositionInCenterIfOutsideViewport(end.getEndPosition());
        }
      });
    } catch {}

    // Ensure word navigation works even if host environment swallows default bindings
    try {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.LeftArrow, () => {
        editor.trigger('keyboard', 'cursorWordLeft', null);
      }, '!editorReadonly');
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.RightArrow, () => {
        editor.trigger('keyboard', 'cursorWordRight', null);
      }, '!editorReadonly');
      editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow, () => {
        editor.trigger('keyboard', 'cursorWordLeft', null);
      }, '!editorReadonly');
      editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.RightArrow, () => {
        editor.trigger('keyboard', 'cursorWordRight', null);
      }, '!editorReadonly');
    } catch {}

    // As a stronger fallback, intercept at the DOM capture phase for Arrow navigation
    try {
      const dom = editor.getDomNode();
      if (dom) {
        const domKeydown = (evt: KeyboardEvent) => {
          const isCtrlCmd = evt.ctrlKey || evt.metaKey;
          const isAlt = evt.altKey;
          const isLeft = evt.key === 'ArrowLeft' || evt.code === 'ArrowLeft';
          const isRight = evt.key === 'ArrowRight' || evt.code === 'ArrowRight';
          if ((isCtrlCmd || isAlt) && (isLeft || isRight)) {
            // eslint-disable-next-line no-console
            console.debug('[CodeEditor] DOM-capture nav', { ctrl: !!evt.ctrlKey, meta: !!evt.metaKey, alt: !!evt.altKey, key: evt.key, code: evt.code });
            evt.preventDefault();
            evt.stopPropagation();
            editor.trigger('keyboard', isLeft ? 'cursorWordLeft' : 'cursorWordRight', null);
          }
        };
        dom.addEventListener('keydown', domKeydown, { capture: true });
        editor.onDidDispose(() => {
          try { dom.removeEventListener('keydown', domKeydown, { capture: true } as any); } catch {}
        });
      }
    } catch {}
  };

  return (
    <Editor
      height={memoHeight}
      language={normalizedLanguage}
      value={value}
      onChange={(val: string | undefined) => onChange(val ?? '')}
      theme="vs-light"
      onMount={handleMount}
      loading={<div className="p-2 text-xs text-gray-400">Loading editor…</div>}
      options={{
        wordWrap: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12,
        automaticLayout: true,
        formatOnPaste: true,
        formatOnType: true,
        tabSize: 2,
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true },
        'semanticHighlighting.enabled': true,
        lineNumbers: 'on',
        readOnly,
      }}
      className={className}
    />
  );
};

export default CodeEditor;
