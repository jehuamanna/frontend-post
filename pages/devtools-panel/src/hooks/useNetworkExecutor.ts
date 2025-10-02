import { useEffect, useRef } from 'react';

interface PortMessage {
  type: string;
  result?: FetchResult;
  error?: string;
  requestId?: string;
}

/**
 * Utility for executing fetch requests via the background script
 *
 * This does NOT manage local React state.
 */
export const useFetchExecutor = () => {
  // Create a ref to store the port connection to the background script
  const portRef = useRef<chrome.runtime.Port | null>(null);
  // Create a ref for pending requests
  const pendingRequestsRef = useRef<
    Map<string, { resolve: (value: FetchResult) => void; reject: (reason: Error) => void }>
  >(new Map());

  // Set up the port connection when the hook is first used
  useEffect(() => {
    // Establish a connection to the background script
    const port = chrome.runtime.connect({ name: 'devtools-panel' });
    portRef.current = port;

    // Set up message handler to receive responses from the background script
    port.onMessage.addListener((message: PortMessage) => {
      console.log('Received message from background:', message);

      if (message.requestId) {
        const pendingRequest = pendingRequestsRef.current.get(message.requestId);

        if (pendingRequest) {
          if (message.type === 'FETCH_RESULT' && message.result) {
            pendingRequest.resolve(message.result);
          } else if (message.type === 'FETCH_ERROR' && message.error) {
            pendingRequest.reject(new Error(message.error));
          }
          pendingRequestsRef.current.delete(message.requestId);
        }
      } else if (message.type === 'FETCH_ERROR' && message.error) {
        // Handle error response without requestId by rejecting all pending requests
        pendingRequestsRef.current.forEach(request => {
          request.reject(new Error(message.error));
        });
        pendingRequestsRef.current.clear();
      }
    });

    // Clean up the port connection when the component unmounts
    return () => {
      if (portRef.current) {
        portRef.current.disconnect();
        portRef.current = null;
      }
    };
  }, []);

  /**
   * Execute a fetch request via the background script and return the results
   */
  const executeFetch = async (fetchUrl: string, options: RequestInit | undefined | null): Promise<FetchResult> => {
    try {
      // Basic validation before sending to background
      const url = fetchUrl.trim();
      if (!url) {
        return {
          body: 'Error: URL is required',
          headers: '',
          cookies: [],
          statusCode: null,
        };
      }

      // Check if port is established
      if (!portRef.current) {
        return {
          body: 'Error: Connection to background script not established',
          headers: '',
          cookies: [],
          statusCode: null,
        };
      }

      // Generate a unique request ID
      const requestId = `${url}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Create a promise that will be resolved when we receive a response
      const requestPromise = new Promise<FetchResult>((resolve, reject) => {
        pendingRequestsRef.current.set(requestId, { resolve, reject });

        // Send the request to the background script
        portRef.current?.postMessage({
          type: 'EXECUTE_FETCH',
          url,
          options: options ?? {},
          requestId,
        });

        // Set a timeout to reject the promise if we don't get a response
        setTimeout(() => {
          if (pendingRequestsRef.current.has(requestId)) {
            pendingRequestsRef.current.delete(requestId);
            reject(new Error('Request timed out'));
          }
        }, 30000); // 30 second timeout
      });

      // Wait for the response
      return await requestPromise;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        body: `Error executing fetch: ${errorMessage}`,
        headers: '',
        cookies: [],
        statusCode: null,
      };
    }
  };

  return { executeFetch };
};

export interface FetchResult {
  body: string;
  headers: string;
  cookies: string[];
  statusCode: number | null;
}
