import { extractCookiesFromRawHeaders } from './RawNetworkCapture';

export interface FetchResult {
  body: string;
  headers: string;
  cookies: string[];
  statusCode: number | null;
}

/**
 * Utility for executing fetch requests with raw cookie extraction
 *
 * This does NOT manage local React state.
 */
export const useFetchExecutor = () => {
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

      // Try raw Set-Cookie extraction (from devtools / network capture)
      try {
        const rawCookies = extractCookiesFromRawHeaders(url);
        if (rawCookies && rawCookies.length > 0) {
          cookies = rawCookies;
        }
      } catch (e) {
        console.log('Error extracting raw cookies:', e);
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
        const json = await response.json();
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

  return { executeFetch };
};
