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
  const { extractHttpMethod, extractUrlPath, extractFetchDetails } = useFetchParser();
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
    const t = text.trim();
    if (/^curl\s/i.test(t)) return 'bash';
    if (/(\bfetch\s*\(|\baxios\s*\(|\basync\s+function|\.then\(|\bawait\s+fetch\s*\()/i.test(t)) return 'javascript';
    return 'plaintext';
  }, [activeTab?.inputs.editorLeft]);

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

  // Clear active tab
  const handleClear = () => {
    setTabs(prev =>
      prev.map(t =>
        t.id === activeTabId
          ? { ...t, inputs: { requestType: 'fetch', options: {}, editorLeft: '', editorRight: '' }, outputs: {} }
          : t,
      ),
    );
    if (ref.current) ref.current.innerText = '';
  };

  // Add new tab
  const handleAddTab = () => {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      name: `Tab ${tabs.length + 1}`,
      inputs: { requestType: 'fetch', options: {}, editorLeft: '', editorRight: '' },
      outputs: {},
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
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
    // And parse options alongside it
    updateTabInput(activeTabId, 'options', looseRecursiveJSONParse(fetchDetails.options ?? ''));
    console.log('dddddddddddddddddddd', tabs);
    console.log('active tab id:', activeTabId);
  };

  return (
    <div className="h-vh w-wh max-h-[100v] max-w-[100vw]">
      <div className="rounded-lg border border-gray-200 shadow-sm">
        {/* Tab Bar */}
        <div className="flex items-center border-b border-gray-200">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`border px-4 py-2 ${activeTabId === tab.id ? 'bg-gray-100' : 'bg-white'}`}>
                {tab.name}
              </button>
            ))}
          </div>
          <button onClick={handleAddTab} className="ml-1 rounded-lg border px-4 py-2">
            +
          </button>
        </div>
        <div>
          {/* Editors Row */}
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Left monaco editor */}
              <div className="flex flex-col">
                <div className="mb-2 text-sm font-medium text-gray-700">Request</div>
                <CodeEditor
                  value={activeTab?.inputs.editorLeft ?? ''}
                  onChange={val => updateTabInput(activeTabId, 'editorLeft', val)}
                  language={leftEditorLanguage}
                  onCtrlEnter={handleExecute}
                  height={280}
                />
              </div>
              {/* Right monaco editor */}
              <div className="flex flex-col">
                <div className="mb-2 text-sm font-medium text-gray-700">Response</div>
                <CodeEditor
                  value={rightEditorPrettyValue}
                  onChange={val => updateTabInput(activeTabId, 'editorRight', val)}
                  language="json"
                  readOnly={true}
                  height={280}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-row items-center space-x-2">
              <Button onClick={handleClear} variant="outline" className="whitespace-nowrap">
                Clear
              </Button>
              <Button onClick={handleExecute} variant="outline" className="whitespace-nowrap">
                Execute
              </Button>
              <Button onClick={handleInjectAndExecute} variant="outline" className="whitespace-nowrap">
                Inject & Execute
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Panel, <LoadingSpinner />), ErrorDisplay);
