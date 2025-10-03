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
 * Recursively parse JSON strings within an object/array
 * This helps when APIs return JSON as strings within other JSON objects
 */
const recursivelyParseJsonStrings = (obj: any): any => {
  if (typeof obj === 'string') {
    // Try to parse the string as JSON
    const trimmed = obj.trim();
    
    // Check if it looks like JSON (starts with { or [ and ends with } or ])
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        console.log('Successfully parsed JSON string:', trimmed.substring(0, 100) + '...');
        // Recursively parse the newly parsed object
        return recursivelyParseJsonStrings(parsed);
      } catch (error) {
        console.log('Failed to parse JSON string:', trimmed.substring(0, 100) + '...', error);
        // If parsing fails, return the original string
        return obj;
      }
    }
    
    // Also try to parse strings that might be JSON but with escaped quotes
    if (trimmed.includes('\\"') && (trimmed.includes('\\"{') || trimmed.includes('\\"}') || trimmed.includes('\\"['))) {
      try {
        // First, try to parse as a JSON string (which would unescape it)
        const unescaped = JSON.parse(`"${trimmed}"`);
        if (typeof unescaped === 'string') {
          // Now try to parse the unescaped string as JSON
          const parsed = JSON.parse(unescaped);
          console.log('Successfully parsed escaped JSON string');
          return recursivelyParseJsonStrings(parsed);
        }
      } catch (error) {
        console.log('Failed to parse escaped JSON string:', error);
      }
    }
    
    return obj;
  }
  
  if (Array.isArray(obj)) {
    // Recursively parse each element in the array
    return obj.map(item => recursivelyParseJsonStrings(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    // Recursively parse each property in the object
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = recursivelyParseJsonStrings(value);
    }
    return result;
  }
  
  // For primitives (number, boolean, null), return as-is
  return obj;
};

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

      // Ensure body is properly stringified if it's an object
      if (options.body && typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
        
        // Auto-add Content-Type header for JSON bodies if not already present
        if (!options.headers) {
          options.headers = {};
        }
        const headers = options.headers as Record<string, string>;
        const hasContentType = Object.keys(headers).some(key => 
          key.toLowerCase() === 'content-type'
        );
        if (!hasContentType) {
          headers['Content-Type'] = 'application/json';
        }
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

    console.log('Executing fetch with:', { url, options });
    console.log('Options headers:', options.headers);
    
    const response = await fetch(url, options);
    const statusCode = response.status;
    
    console.log('Fetch response:', { status: statusCode, ok: response.ok });

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

    // Response body with recursive JSON parsing
    let body: string;
    const contentType = response.headers.get('content-type');
    console.log('Response content-type:', contentType);
    
    if (contentType && contentType.includes('application/json')) {
      const json = await response.json().catch(() => ({}));
      console.log('Original JSON response:', json);
      
      const recursivelyParsedJson = recursivelyParseJsonStrings(json);
      console.log('After recursive parsing:', recursivelyParsedJson);
      
      body = JSON.stringify(recursivelyParsedJson, null, 2);
    } else {
      body = await response.text();
      console.log('Non-JSON response body:', body.substring(0, 200) + '...');
    }

    // Apply recursive parsing to the final response structure
    const responsePayload = {
      body: body,
      headers: enhancedHeaders,
      cookies,
      statusCode,
    };
    
    const finalParsedResponse = recursivelyParseJsonStrings(responsePayload);
    console.log('Final parsed response:', finalParsedResponse);
    
    return finalParsedResponse;
  } catch (error: unknown) {
    console.error('Fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide more specific error information
    let detailedError = `Error executing fetch: ${errorMessage}`;
    if (error instanceof TypeError && errorMessage.includes('Failed to fetch')) {
      detailedError += '\n\nPossible causes:\n' +
        '• CORS policy blocking the request\n' +
        '• Network connectivity issues\n' +
        '• Invalid URL or unreachable server\n' +
        '• Missing required headers (e.g., Content-Type for POST requests)';
    }
    
    return {
      body: detailedError,
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
