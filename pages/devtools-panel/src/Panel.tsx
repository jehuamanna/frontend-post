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
import { useState, useRef, useEffect, useCallback } from 'react';
import type { Tab } from './types';

const Panel = () => {
  const { tabs, setTabs } = useTabs();
  const { extractHttpMethod, extractUrlPath, extractFetchDetails } = useFetchParser();
  const { executeFetch } = useFetchExecutor();
  console.log('tabs--------------:', tabs[0]?.id);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id ?? '');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalValue, setModalValue] = useState('');
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
      updateTabInput(activeTabId, 'command', el.innerText);
    };

    el.addEventListener('input', handleInput);
    return () => {
      el.removeEventListener('input', handleInput);
    };
  }, [updateTabInput, activeTabId]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.innerText = activeTab?.inputs.command || '';
  }, [activeTabId, activeTab]);

  // Expand modal editor
  const handleExpand = () => {
    const currentValue = ref.current?.innerText || activeTab?.inputs.url || '';
    setModalValue(currentValue);
    setModalOpen(true);
  };

  // Save modal content back to context
  const handleSave = () => {
    if (ref.current) {
      ref.current.innerText = modalValue;
    }
    updateTabInput(activeTabId, 'command', modalValue);
    setModalOpen(false);
  };

  // Clear active tab
  const handleClear = () => {
    setTabs(prev =>
      prev.map(t =>
        t.id === activeTabId
          ? { ...t, inputs: { url: '', command: '', requestType: 'fetch', options: {} }, outputs: {} }
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
      inputs: { url: '', command: '', requestType: 'fetch', options: {} },
      outputs: {},
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleExecute = async () => {
    const response = await executeFetch(activeTab?.inputs.url ?? '', JSON.stringify(activeTab?.inputs.options ?? {}));
    updateTabOutput(activeTabId, 'statusCode', response.statusCode?.toString() ?? '');
    updateTabOutput(activeTabId, 'body', response.body);
    updateTabOutput(activeTabId, 'headers', response.headers);
    updateTabOutput(activeTabId, 'cookies', response.cookies.join(', '));
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
    updateTabInput(activeTabId, 'url', fetchDetails.url ?? '');

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

        {/* Content Area */}
        <div className="p-4">
          {/* Top Input Area */}
          <div className="mb-4 flex">
            <div className="flex w-full items-start">
              {/* editor */}
              <div className="relative flex-1">
                <div
                  ref={ref}
                  contentEditable
                  onInput={handleInput}
                  onPaste={handlePaste}
                  suppressContentEditableWarning
                  data-placeholder={placeholder}
                  className="editable h-36 w-[400px] overflow-y-auto rounded-lg border border-gray-300 p-2 font-sans text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
                {/* Expand button */}
                <button
                  type="button"
                  onClick={handleExpand}
                  className="absolute left-[410px] top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                  <Maximize2 size={16} />
                </button>
              </div>
              {/* Modal editor */}
              {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">

                  <div className="flex h-3/4 w-3/4 flex-col rounded-lg bg-white shadow-lg">

                    {/* Header */}
                    <div className="flex items-center justify-between border-b p-3">

                      <h2 className="text-lg font-semibold">Edit Content</h2>
                      <button onClick={() => setModalOpen(false)} className="p-1 text-gray-500 hover:text-gray-700">

                        <X size={20} />
                      </button>
                    </div>
                    {/* Editable big editor */}
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onInput={e => setModalValue((e.target as HTMLDivElement).innerText)}
                      className="flex-1 overflow-y-auto p-4 outline-none"
                      data-placeholder={placeholder}>

                      {modalValue}
                    </div>
                    {/* Footer */}
                    <div className="flex justify-end gap-2 border-t p-3">

                      <button
                        onClick={() => setModalOpen(false)}
                        className="rounded-md bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200">

                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        className="rounded-md bg-gray-600 px-4 py-2 text-white hover:bg-gray-700">

                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* buttons */}
              <div className="ml-4 flex flex-row items-center space-x-2">
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

          {/* Bottom Panels */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="flex flex-col space-y-4">
              <div className="rounded-lg border border-gray-200 p-3">
                <div
                  onChange={e =>
                    setTabs(
                      tabs.map(t =>
                        t.id === activeTabId ? { ...t, inputs: { ...t.inputs, url: e.target.value } } : t,
                      ),
                    )
                  }
                  className="text-center text-gray-700">
                  {activeTab?.inputs.url}
                </div>
              </div>

              <div className="min-h-[200px] rounded-lg border border-gray-200 p-3">
                <div className="text-center text-gray-700">
                  <JSONViewer
                    jsonString={JSON.stringify(activeTab?.inputs.options ?? {}, null, 2)}
                    onChange={newJson =>
                      updateTabInput(activeTabId, 'options', looseRecursiveJSONParse(newJson ?? ''))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col space-y-4">
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-center text-gray-700">
                  <JSONViewer
                    jsonString={activeTab?.outputs.body ?? ''}
                    onChange={newJson => updateTabOutput(activeTabId, 'body', newJson ?? '')}
                  />
                </div>
              </div>

              <div className="min-h-[200px] rounded-lg border border-gray-200 p-3">
                <div className="text-center text-gray-700">
                  <JSONViewer
                    jsonString={activeTab?.outputs.headers ?? ''}
                    onChange={newJson => updateTabOutput(activeTabId, 'headers', newJson ?? '')}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Panel, <LoadingSpinner />), ErrorDisplay);
