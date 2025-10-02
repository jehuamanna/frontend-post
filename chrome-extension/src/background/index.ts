import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';

exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

console.log('Background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");

/**
 * Directly retrieve cookies for a URL
 */
const getCookiesForUrl = async (urlString: string): Promise<string[]> => {
  try {
    const url = new URL(urlString);
    const cookies = await chrome.cookies.getAll({ domain: url.hostname });

    if (cookies.length > 0) {
      // Format cookies as Set-Cookie headers for consistency with HTTP responses
      return cookies.map(
        cookie => `${cookie.name}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}${cookie.secure ? '; Secure' : ''}${cookie.httpOnly ? '; HttpOnly' : ''}`
      );
    }
    return [];
  } catch (error) {
    console.error('Error retrieving cookies for URL:', urlString, error);
    return [];
  }
};

// Interface for fetch execution results
interface FetchResult {
  body: string;
  headers: Record<string, string | string[]>;
  cookies: string[];
  statusCode: number | null;
}

/**
 * Execute a fetch request and return the results
 */
const executeFetch = async (fetchUrl: string, headersAndCookies: unknown): Promise<FetchResult> => {
  try {
    const url = fetchUrl.trim();
    if (!url) {
      return {
        body: 'Error: URL is required',
        headers: {},
        cookies: [],
        statusCode: null,
      };
    }

    let options: RequestInit = {};
    try {
      if (typeof headersAndCookies === 'string') {
        const s = headersAndCookies.trim();
        if (s) options = JSON.parse(s);
      } else if (headersAndCookies && typeof headersAndCookies === 'object') {
        options = headersAndCookies as RequestInit;
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error parsing JSON';
      return {
        body: `Error parsing fetch options: ${errorMessage}`,
        headers: {},
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

    // Get cookies directly using the cookies API
    const siteCookies = await getCookiesForUrl(url);
    if (siteCookies.length > 0) {
      console.log('Found cookies for URL:', url, siteCookies);
      cookies = siteCookies;
    }

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
      headers: enhancedHeaders,
      cookies,
      statusCode,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      body: `Error executing fetch: ${errorMessage}`,
      headers: {},
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
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during fetch';
          port.postMessage({
            type: 'FETCH_ERROR',
            error: errorMessage,
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
