import '@src/Popup.css';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';
import { useState } from 'react';
import { Button } from './components/ui/button';

const Popup = () => {
  const [activeTab] = useState('Tab 1');
  const [tabs] = useState(['Tab 1']);

  return (
    <div className="m-auto max-w-[1200px] p-4">
      <div className="rounded-lg border border-gray-200 shadow-sm">
        {/* Tab Bar */}
        <div className="flex items-center border-b border-gray-200 px-2">
          <div className="flex space-x-1 overflow-x-auto py-2">
            {tabs.map(tab => (
              <button
                key={tab}
                className={`rounded-lg border px-4 py-2 ${activeTab === tab ? 'bg-gray-100' : 'bg-white'}`}>
                {tab}
              </button>
            ))}
          </div>
          <button className="ml-1 rounded-lg border px-4 py-2">+</button>
        </div>

        {/* Content Area */}
        <div className="p-4">
          {/* Top Input Area */}
          <div className="mb-4 flex">
            <div className="flex-grow">
              <textarea
                className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows="4"
                placeholder="// editable content to paste fetch call"
              />
            </div>
            <div className="ml-4 flex flex-col space-y-2">
              <Button variant="outline" className="whitespace-nowrap">
                Clear
              </Button>
              <Button variant="outline" className="whitespace-nowrap">
                Execute
              </Button>
              <Button variant="outline" className="whitespace-nowrap">
                Inject & Execute
              </Button>
            </div>
          </div>

          {/* Bottom Panels */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="flex flex-col space-y-4">
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-center text-gray-700">{'//Editable, extract & show the Fetch URL here'}</div>
              </div>

              <div className="min-h-[200px] rounded-lg border border-gray-200 p-3">
                <div className="text-center text-gray-700">
                  {'//Editable, extract & show the cookies and headers from Fetch URL here'}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col space-y-4">
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="text-center text-gray-700">
                  {'//non-Editable, show the response body of the fetch request here'}
                </div>
              </div>

              <div className="min-h-[200px] rounded-lg border border-gray-200 p-3">
                <div className="text-center text-gray-700">
                  {'//non-Editable, show the complete response headers, including browser setting headers here'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
