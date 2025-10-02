import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';

exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

console.log('Background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");

// Interface for fetch execution results
interface FetchResult {
  body: string;
  headers: string;
  cookies: string[];
  statusCode: number | null;
}

/**
 * Execute a fetch request and return the results
 */
const executeFetch = async (fetchUrl: string, headersAndCookies: string): Promise<FetchResult> => {
  try {
    const url = fetchUrl.trim();
    if (!url) {
      return {
        body: 'Error: URL is required',
        headers: '',
        cookies: [],
        statusCode: null,
      };
    }

    let options: RequestInit = {};
    try {
      if (headersAndCookies.trim()) {
        options = JSON.parse(headersAndCookies);
      }
    } catch (err: any) {
      return {
        body: `Error parsing fetch options: ${err.message}`,
        headers: '',
        cookies: [],
        statusCode: null,
      };
    }

    const response = await fetch(url, options);
    const statusCode = response.status;

    const headers: Record<string, string | string[]> = {};
    let cookies: string[] = [];

    // First pass: collect headers
    if (response.headers && typeof response.headers.forEach === 'function') {
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
        if (key.toLowerCase() === 'set-cookie') {
          cookies.push(value);
        }
      });
    }

    // In the background script we might not have access to extractCookiesFromRawHeaders
    // So we'll just rely on the headers collection

    // Ensure Set-Cookie header is visible
    if (cookies.length > 0) {
      headers['set-cookie'] = cookies.length === 1 ? cookies[0] : cookies;
    } else {
      headers['set-cookie'] = '[Browser security may be restricting access to Set-Cookie headers]';
    }

    const enhancedHeaders = {
      _note: 'If Set-Cookie headers are present, they are shown in the Cookies section below with better formatting.',
      ...headers,
    };

    // Response body
    let body: string;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const json = await response.json().catch(() => ({}));
      body = JSON.stringify(json, null, 2);
    } else {
      body = await response.text();
    }

    return {
      body,
      headers: JSON.stringify(enhancedHeaders, null, 2),
      cookies,
      statusCode,
    };
  } catch (error: any) {
    return {
      body: `Error executing fetch: ${error.message}`,
      headers: '',
      cookies: [],
      statusCode: null,
    };
  }
};

// Handle connections from devtools panels
chrome.runtime.onConnect.addListener(port => {
  console.log('Connection established with port:', port.name);

  if (port.name === 'devtools-panel') {
    port.onMessage.addListener(async message => {
      if (message.type === 'EXECUTE_FETCH') {
        console.log('Received fetch request:', message);
        try {
          const result = await executeFetch(message.url, message.options);
          port.postMessage({
            type: 'FETCH_RESULT',
            result,
            requestId: message.requestId, // Pass back the requestId for request matching
          });
        } catch (error: any) {
          port.postMessage({
            type: 'FETCH_ERROR',
            error: error.message || 'Unknown error occurred during fetch',
            requestId: message.requestId, // Pass back the requestId even for errors
          });
        }
      }
    });

    // Handle disconnection
    port.onDisconnect.addListener(() => {
      console.log('Devtools panel disconnected');
    });
  }
});
