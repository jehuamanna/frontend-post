import { createContext, useContext, useEffect, useState } from 'react';
import type { Tab } from './types.ts';

type TabsContextType = {
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
};

const TabsContext = createContext<TabsContextType | undefined>(undefined);

// Factory for a default tab
const createDefaultTab = (): Tab => ({
  id: crypto.randomUUID(),
  name: 'New Tab',
  inputs: {
    command: '',
    url: '',
    requestType: 'fetch',
    options: {},
  },
  outputs: {},
});

export const TabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<Tab[]>([createDefaultTab()]);

  // Load from chrome.storage.local
  useEffect(() => {
    chrome.storage.local.get('tabs', data => {
      if (data.tabs) {
        setTabs(data.tabs as Tab[]);
      }
    });
  }, []);

  // Save to chrome.storage.local
  useEffect(() => {
    chrome.storage.local.set({ tabs });
  }, [tabs]);

  return <TabsContext.Provider value={{ tabs, setTabs }}>{children}</TabsContext.Provider>;
};

export const useTabs = (): TabsContextType => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('useTabs must be used within a TabsProvider');
  }
  return context;
};
