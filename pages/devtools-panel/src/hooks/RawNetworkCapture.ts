/**
 * This utility helps to intercept network requests and capture raw headers
 * including Set-Cookie headers that might be filtered by the Fetch API
 */

type HeaderMap = Record<string, string | string[]>;

interface StoredHeaders {
  headers: HeaderMap;
  timestamp: number;
}

// Store for intercepted headers
const rawHeadersStore: Map<string, StoredHeaders> = new Map();

/**
 * Setup network interception using Chrome's webRequest API
 */
const setupNetworkInterception = (): void => {
  if (typeof chrome === 'undefined' || !chrome.webRequest) {
    console.log('Chrome webRequest API not available for header interception');
    return;
  }

  try {
    chrome.webRequest.onHeadersReceived.addListener(
      (details: chrome.webRequest.WebResponseHeadersDetails): chrome.webRequest.BlockingResponse => {
        if (details.responseHeaders) {
          const headerMap: HeaderMap = {};

          // Extract headers
          details.responseHeaders.forEach(header => {
            if (!header.name) return;
            const name = header.name.toLowerCase();
            const value = header.value ?? '';

            if (name === 'set-cookie') {
              if (!headerMap[name]) {
                headerMap[name] = [];
              }
              (headerMap[name] as string[]).push(value);
            } else {
              headerMap[name] = value;
            }
          });

          // Store by URL with timestamp
          rawHeadersStore.set(details.url, {
            headers: headerMap,
            timestamp: Date.now(),
          });
        }
        return { responseHeaders: details.responseHeaders };
      },
      { urls: ['<all_urls>'] },
      ['responseHeaders', 'extraHeaders'],
    );

    console.log('Network interception for raw headers setup complete');

    // Cleanup expired entries periodically (5 minutes expiration)
    setInterval(() => {
      const now = Date.now();
      for (const [url, data] of rawHeadersStore.entries()) {
        if (now - data.timestamp > 5 * 60 * 1000) {
          rawHeadersStore.delete(url);
        }
      }
    }, 60 * 1000);
  } catch (e) {
    console.error('Error setting up network interception:', e);
  }
};

/**
 * Get raw headers for a URL if available
 */
const getRawHeaders = (url: string): HeaderMap | null => {
  const stored = rawHeadersStore.get(url);
  return stored ? stored.headers : null;
};

/**
 * Extract cookies from raw headers
 */
const extractCookiesFromRawHeaders = (url: string): string[] => {
  const rawHeaders = getRawHeaders(url);
  if (rawHeaders && rawHeaders['set-cookie']) {
    return Array.isArray(rawHeaders['set-cookie']) ? rawHeaders['set-cookie'] : [rawHeaders['set-cookie']];
  }
  return [];
};

// Initialize interception immediately
setupNetworkInterception();

const RawNetworkCapture = {
  getRawHeaders,
  extractCookiesFromRawHeaders,
  setupNetworkInterception,
};

export { getRawHeaders, extractCookiesFromRawHeaders, setupNetworkInterception };
export default RawNetworkCapture;
