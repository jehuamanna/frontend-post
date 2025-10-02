import '@src/Panel.css';
import { Button } from './components/ui/button';
import { useFetchExecutor } from './hooks/useNetworkExecutor';
import { useFetchParser } from './hooks/useRequestParser';
import JSONViewer from './JSONViewer';
import { looseRecursiveJSONParse } from './lib/utils';
import { useTabs } from './TabsContext';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { Maximize2, X } from 'lucide-react'; // expand icon
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import CodeEditor from './components/CodeEditor';
import type { Tab } from './types';

const Panel = () => {
  const { tabs, setTabs } = useTabs();
  const { extractHttpMethod, extractUrlPath, extractFetchDetails, detectLanguage } = useFetchParser();
  const { executeFetch } = useFetchExecutor();
  console.log('tabs--------------:', tabs[0]?.id);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id ?? '');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalValue, setModalValue] = useState('');
  const modalPanelRef = useRef<HTMLDivElement | null>(null);
  const [modalToast, setModalToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [modalToastTimer, setModalToastTimer] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab | undefined>(tabs.find(t => t.id === activeTabId));
  const placeholder = 'Enter the Curl or Fetch Request';
  const ref = useRef<HTMLDivElement>(null);

  // Rename state for inline tab title editing (only the portion after HTTP METHOD)
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState<string>('');

  // Reorder unnamed tabs to always start from 1 and be sequential
  useEffect(() => {
    setTabs(prev => {
      let counter = 1;
      return prev.map(t => {
        const m = /^Tab(\d+)$/.exec(t.name?.trim() ?? '');
        if (m && !t.userRenamed) {
          // This is an unnamed tab, renumber it sequentially
          return { ...t, name: `Tab${counter++}` };
        }
        return t;
      });
    });
  }, [tabs.length, setTabs]);

  // Compute next default tab name in the form Tab<number>
  const getNextTabDefaultName = useCallback((): string => {
    // Collect existing Tab<number> indices
    const used = new Set(
      tabs
        .map(t => {
          const m = /^Tab(\d+)$/.exec(t.name?.trim() ?? '');
          return m ? parseInt(m[1], 10) : null;
        })
        .filter((n): n is number => n !== null),
    );
    // Find the smallest positive integer not used
    let n = 1;
    while (used.has(n)) n += 1;
    return `Tab${n}`;
  }, [tabs]);

  // Update tab name based on request content (METHOD lastPath), always re-evaluating
  const updateTabNameFromContent = useCallback(
    (tabId: string, content: string) => {
      try {
        const method = extractHttpMethod(content)?.toUpperCase();
        const path = extractUrlPath(content);
        setTabs(prev =>
          prev.map(t => {
            if (t.id !== tabId) return t;

            const current = t.name ?? '';
            const first = current.trim().split(/\s+/)[0] ?? '';
            const hasMethodPrefix = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/i.test(first);
            const existingSuffix = hasMethodPrefix ? current.slice(first.length).trimStart() : current;

            if (t.userRenamed) {
              // User controls suffix; we only manage the method prefix
              if (method) {
                return { ...t, name: `${method} ${existingSuffix}`.trim() };
              }
              // No method detected: strip any existing method prefix
              return { ...t, name: existingSuffix };
            }

            // Auto-managed naming
            if (method) {
              const auto = path ? `${method} ${path}` : method;
              return { ...t, name: auto };
            }

            // No method; use path if available, otherwise strip stale method prefix
            if (path) {
              return { ...t, name: path };
            }

            const fallback = existingSuffix || current || getNextTabDefaultName();
            return { ...t, name: fallback };
          }),
        );
      } catch {
        // ignore parse errors
      }
    },
    [extractHttpMethod, extractUrlPath, setTabs, getNextTabDefaultName],
  );

  useEffect(() => {
    setActiveTab(tabs.find(t => t.id === activeTabId));
  }, [tabs, activeTabId]);

  // Update tab input in context
  const updateTabInput = useCallback(
    (tabId: string, field: string, value: any) => {
      setTabs(prev => prev.map(t => (t.id === tabId ? { ...t, inputs: { ...t.inputs, [`${field}`]: value } } : t)));
    },
    [setTabs],
  );

  const updateTabOutput = useCallback(
    (tabId: string, field: string, value: string) => {
      setTabs(prev => prev.map(t => (t.id === tabId ? { ...t, outputs: { ...t.outputs, [`${field}`]: value } } : t)));
    },
    [setTabs],
  );

  // Keep ref and context in sync
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleInput = () => {
      if (el.innerHTML === '<br>') el.innerHTML = '';
      updateTabInput(activeTabId, 'editorLeft', el.innerText);
    };

    el.addEventListener('input', handleInput);
    return () => {
      el.removeEventListener('input', handleInput);
    };
  }, [updateTabInput, activeTabId]);

  // Helpers for tab method parsing and color coding
  const getMethodFromTabName = (name?: string): string | null => {
    if (!name) return null;
    const first = name.trim().split(/\s+/)[0];
    if (/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/i.test(first)) return first.toUpperCase();
    return null;
  };

  const methodBadgeClass = (method: string | null): string => {
    switch (method) {
      case 'GET':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'POST':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'PUT':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'PATCH':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'DELETE':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'OPTIONS':
      case 'HEAD':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  // Start rename on double click, only editing portion after METHOD (if present)
  const startRename = (tab: Tab) => {
    const method = getMethodFromTabName(tab.name);
    if (method) {
      const rest = tab.name.slice(method.length).trimStart();
      setRenameInput(rest);
    } else {
      setRenameInput(tab.name ?? '');
    }
    setRenamingTabId(tab.id);
  };

  // Commit rename on blur or Enter
  const commitRename = (tab: Tab) => {
    const method = getMethodFromTabName(tab.name);
    const trimmed = renameInput.trim();
    const newName = method ? `${method} ${trimmed}`.trim() : trimmed || tab.name;
    setTabs(prev => prev.map(t => (t.id === tab.id ? { ...t, name: newName, userRenamed: true } : t)));
    setRenamingTabId(null);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.innerText = activeTab?.inputs.editorLeft || '';
  }, [activeTabId, activeTab]);

  // Expand modal editor
  const handleExpand = () => {
    const currentValue = ref.current?.innerText || activeTab?.inputs.editorLeft || '';
    setModalValue(currentValue);
    setModalOpen(true);
  };

  // Focus the modal panel when it opens, so blur can be detected reliably
  useEffect(() => {
    // Focus on next tick to ensure element exists
    let timeoutId: number | null = null;
    if (modalOpen) {
      timeoutId = window.setTimeout(() => {
        modalPanelRef.current?.focus();
      }, 0);
    }
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [modalOpen]);

  // Save modal content back to context
  const applyModalChanges = () => {
    // Keep editorLeft in sync with modal text
    if (ref.current) {
      ref.current.innerText = modalValue;
    }
    updateTabInput(activeTabId, 'editorLeft', modalValue);
    // Update name from content
    updateTabNameFromContent(activeTabId, modalValue);

    // Parse options from the edited content (URL is derived at execute time)
    const details = extractFetchDetails(modalValue);
    updateTabInput(activeTabId, 'options', looseRecursiveJSONParse(details.options ?? ''));
  };

  const handleSave = () => {
    applyModalChanges();
    // Show toast, then close after a short delay so user can see it
    // If you later want to reflect parse status, you can pass type accordingly
    if (modalToastTimer) window.clearTimeout(modalToastTimer);
    setModalToast({ message: 'Saved', type: 'success' });
    const id = window.setTimeout(() => {
      setModalToast(null);
      setModalOpen(false);
    }, 1000);
    setModalToastTimer(id);
  };

  // Compute display text for options to avoid showing quoted strings
  const optionsText = useMemo(() => {
    const options = activeTab?.inputs.options as unknown;
    try {
      if (typeof options === 'string') {
        // Try parsing; if it fails, show as-is (unquoted), not JSON-stringified
        try {
          const parsed = JSON.parse(options);
          return JSON.stringify(parsed, null, 2);
        } catch {
          return options as string;
        }
      }
      return JSON.stringify(options ?? {}, null, 2);
    } catch {
      return String(options ?? '');
    }
  }, [activeTab?.inputs.options]);

  // Determine language for left editor based on content
  const leftEditorLanguage = useMemo(() => {
    const text = activeTab?.inputs.editorLeft ?? '';
    return detectLanguage(text);
  }, [activeTab?.inputs.editorLeft, detectLanguage]);

  // Pretty JSON for right editor display, but don't alter stored value
  const rightEditorPrettyValue = useMemo(() => {
    const raw = activeTab?.inputs.editorRight ?? '';
    if (!raw) return '';
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return raw; // if not JSON, show as-is
    }
  }, [activeTab?.inputs.editorRight]);

  // Auto-detect right editor language: json if valid, otherwise plaintext
  const rightEditorLanguage = useMemo(() => {
    const text = rightEditorPrettyValue ?? '';
    if (!text) return 'plaintext';
    try {
      JSON.parse(text);
      return 'json';
    } catch {
      return 'plaintext';
    }
  }, [rightEditorPrettyValue]);

  // Clear active tab
  const handleClear = () => {
    setTabs(prev =>
      prev.map(t =>
        t.id === activeTabId
          ? {
            ...t,
            name: getNextTabDefaultName(),
            userRenamed: false,
            inputs: { requestType: 'fetch', options: {}, editorLeft: '', editorRight: '' },
            outputs: {},
          }
          : t,
      ),
    );
    if (ref.current) ref.current.innerText = '';
  };

  // Add new tab
  const handleAddTab = () => {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      name: getNextTabDefaultName(),
      inputs: { requestType: 'fetch', options: {}, editorLeft: '', editorRight: '' },
      outputs: {},
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  // Close tab; if only one tab remains, replace with a fresh TabN
  const handleCloseTab = (tabId: string) => {
    if (tabs.length <= 1) {
      const newTab: Tab = {
        id: crypto.randomUUID(),
        name: getNextTabDefaultName(),
        inputs: { requestType: 'fetch', options: {}, editorLeft: '', editorRight: '' },
        outputs: {},
      };
      setTabs([newTab]);
      setActiveTabId(newTab.id);
      return;
    }
    const remaining = tabs.filter(t => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      setActiveTabId(remaining[0].id);
    }
  };

  const handleExecute = async () => {
    const rawText = activeTab?.inputs.editorLeft ?? '';
    const details = extractFetchDetails(rawText);
    const url = details.url ?? '';
    // Build options by merging parsed options from the request text with any stored options
    // If stored options is an empty object, prefer parsed options
    const storedOptsRaw = activeTab?.inputs.options;
    const parsedOptsRaw = details.options ?? '';

    const parsedOpts: RequestInit = typeof parsedOptsRaw === 'string'
      ? ((parsedOptsRaw ? (looseRecursiveJSONParse(parsedOptsRaw) as unknown as RequestInit) : {}) as RequestInit)
      : ((parsedOptsRaw ?? {}) as RequestInit);

    const storedOpts: RequestInit = typeof storedOptsRaw === 'string'
      ? ((storedOptsRaw ? (looseRecursiveJSONParse(storedOptsRaw) as unknown as RequestInit) : {}) as RequestInit)
      : ((storedOptsRaw ?? {}) as RequestInit);

    const isEmptyObject = (o: unknown) => !!o && typeof o === 'object' && Object.keys(o as Record<string, unknown>).length === 0;
    const base: RequestInit = isEmptyObject(storedOpts) ? parsedOpts : parsedOpts;
    const optionsObj: RequestInit = { ...base, ...storedOpts };
    if (!url) {
      console.warn(
        '[Devtools Panel] No valid URL parsed from the Request editor. Executor will return an error body and statusCode: null; the Response editor will still display the error payload.'
      );
    }
    const response = await executeFetch(url, optionsObj);
    updateTabOutput(activeTabId, 'statusCode', response.statusCode?.toString() ?? '');
    // Store the entire response payload as a JSON string in the right editor
    const payload = {
      statusCode: response.statusCode ?? null,
      body: response.body ?? '',
      headers: response.headers ?? {},
      cookies: response.cookies ?? [],
    };
    updateTabInput(activeTabId, 'editorRight', JSON.stringify(payload, null, 2));
  };

  const handleInjectAndExecute = () => { };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    console.log('Updated content:', e.currentTarget.innerText);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData?.getData('text') ?? '';

    console.log('pasted text:', text);
    console.log('http method:', extractHttpMethod(text));
    console.log('url path:', extractUrlPath(text));
    const fetchDetails = extractFetchDetails(text);
    console.log('fetch details:', fetchDetails);
    // Store the full pasted content in the left editor
    updateTabInput(activeTabId, 'editorLeft', text);
    // Update name from pasted content
    updateTabNameFromContent(activeTabId, text);
    // And parse options alongside it
    updateTabInput(activeTabId, 'options', looseRecursiveJSONParse(fetchDetails.options ?? ''));
    console.log('dddddddddddddddddddd', tabs);
    console.log('active tab id:', activeTabId);
  };

  return (
    <div className="h-screen w-screen max-h-screen max-w-screen flex flex-col">
      <div className="flex flex-col rounded-lg border border-gray-200 shadow-sm flex-1 min-h-0">
        {/* Top Bar: Tabs */}
        <div className="flex items-center border-b border-gray-200 px-2 py-1">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map(tab => {
              const method = getMethodFromTabName(tab.name);
              const rest = method ? tab.name.slice(method.length).trimStart() : tab.name;
              const isActive = activeTabId === tab.id;
              return (
                <div key={tab.id} className={`flex items-center border rounded max-w-xs ${isActive ? 'bg-gray-100' : 'bg-white'}`}>
                  <button
                    onClick={() => setActiveTabId(tab.id)}
                    className="flex items-center gap-2 px-2 py-1 text-sm truncate"
                    onDoubleClick={() => startRename(tab)}
                    title={tab.name}
                  >
                    <span className={`border text-[10px] px-1 py-0.5 rounded ${methodBadgeClass(method)}`}>
                      {method ?? 'TAB'}
                    </span>
                    {renamingTabId === tab.id ? (
                      <input
                        autoFocus
                        className="bg-transparent outline-none border-b border-dashed border-gray-300 text-sm w-32 truncate"
                        value={renameInput}
                        onChange={e => setRenameInput(e.target.value)}
                        onBlur={() => commitRename(tab)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRename(tab);
                          } else if (e.key === 'Escape') {
                            setRenamingTabId(null);
                          }
                        }}
                      />
                    ) : (
                      <span className="truncate">
                        {rest}
                      </span>
                    )}
                  </button>
                  <button
                    aria-label="Close tab"
                    className="px-2 py-1 text-gray-500 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(tab.id);
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          <button onClick={handleAddTab} className="ml-1 rounded-lg border px-3 py-1 text-sm">
            +
          </button>
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2 px-2 py-2 border-b border-gray-200">
          <Button onClick={handleClear} variant="outline" className="whitespace-nowrap">
            Clear
          </Button>
          <Button onClick={handleExecute} variant="outline" className="whitespace-nowrap">
            Execute
          </Button>
        </div>

        {/* Editors Area */}
        <div className="flex-1 min-h-0 p-3">
          <div className="grid grid-cols-2 gap-3 h-full">
            {/* Left monaco editor */}
            <div className="flex flex-col h-full min-h-0">
              <div className="mb-2 text-sm font-medium text-gray-700">Request</div>
              <div className="flex-1 min-h-0">
                <CodeEditor
                  value={activeTab?.inputs.editorLeft ?? ''}
                  onChange={val => {
                    updateTabInput(activeTabId, 'editorLeft', val);
                    updateTabNameFromContent(activeTabId, val);
                  }}
                  language={leftEditorLanguage}
                  onCtrlEnter={handleExecute}
                  height="100%"
                  className="flex-1 min-h-0"
                />
              </div>
            </div>
            {/* Right monaco editor */}
            <div className="flex flex-col h-full min-h-0">
              <div className="mb-2 text-sm font-medium text-gray-700">Response</div>
              <div className="flex-1 min-h-0">
                <CodeEditor
                  value={rightEditorPrettyValue}
                  onChange={val => updateTabInput(activeTabId, 'editorRight', val)}
                  language={rightEditorLanguage}
                  readOnly={true}
                  height="100%"
                  className="flex-1 min-h-0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-8 border-t border-gray-200 px-3 text-xs text-gray-500 flex items-center justify-between">
          <span>DevTools Request Runner</span>
          {activeTab?.outputs?.statusCode ? (
            <span
              className={`px-2 py-0.5 rounded border font-medium ${(() => {
                const code = parseInt(activeTab?.outputs?.statusCode ?? '', 10);
                if (!isFinite(code)) return 'bg-gray-50 text-gray-600 border-gray-200';
                if (code >= 200 && code < 300) return 'bg-green-100 text-green-700 border-green-300';
                if (code >= 300 && code < 400) return 'bg-blue-100 text-blue-700 border-blue-300';
                if (code >= 400 && code < 500) return 'bg-amber-100 text-amber-700 border-amber-300';
                if (code >= 500) return 'bg-red-100 text-red-700 border-red-300';
                return 'bg-gray-50 text-gray-600 border-gray-200';
              })()}`}
              title="HTTP response status code"
            >
              {activeTab.outputs.statusCode}
            </span>
          ) : (
            <span>Ctrl/Cmd + Enter to Execute</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Panel, <LoadingSpinner />), ErrorDisplay);
