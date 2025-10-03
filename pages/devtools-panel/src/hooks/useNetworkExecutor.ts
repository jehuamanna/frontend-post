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
      console.log('📥 DEBUG: executeFetch (frontend) - Received message from background:', message);

      if (message.requestId) {
        console.log('🆔 DEBUG: executeFetch (frontend) - Message has request ID:', message.requestId);
        const pendingRequest = pendingRequestsRef.current.get(message.requestId);

        if (pendingRequest) {
          console.log('✅ DEBUG: executeFetch (frontend) - Found pending request for ID:', message.requestId);
          if (message.type === 'FETCH_RESULT' && message.result) {
            console.log('🎉 DEBUG: executeFetch (frontend) - Resolving with result:', message.result);
            pendingRequest.resolve(message.result);
          } else if (message.type === 'FETCH_ERROR' && message.error) {
            console.log('❌ DEBUG: executeFetch (frontend) - Rejecting with error:', message.error);
            pendingRequest.reject(new Error(message.error));
          }
          pendingRequestsRef.current.delete(message.requestId);
          console.log('🗑️ DEBUG: executeFetch (frontend) - Removed pending request for ID:', message.requestId);
        } else {
          console.log('⚠️ DEBUG: executeFetch (frontend) - No pending request found for ID:', message.requestId);
        }
      } else if (message.type === 'FETCH_ERROR' && message.error) {
        console.log('💥 DEBUG: executeFetch (frontend) - Global error, rejecting all pending requests:', message.error);
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
    console.log('📡 DEBUG: executeFetch (frontend) - Function entered with:', { fetchUrl, options });
    try {
      // Basic validation before sending to background
      const url = fetchUrl.trim();
      console.log('🌐 DEBUG: executeFetch (frontend) - Trimmed URL:', url);
      
      if (!url) {
        console.log('❌ DEBUG: executeFetch (frontend) - No URL provided, returning error');
        return {
          body: 'Error: URL is required',
          headers: '',
          cookies: [],
          statusCode: null,
        };
      }

      // Check if port is established
      if (!portRef.current) {
        console.log('❌ DEBUG: executeFetch (frontend) - No port connection, returning error');
        return {
          body: 'Error: Connection to background script not established',
          headers: '',
          cookies: [],
          statusCode: null,
        };
      }

      // Generate a unique request ID
      const requestId = `${url}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      console.log('🆔 DEBUG: executeFetch (frontend) - Generated request ID:', requestId);

      // Create a promise that will be resolved when we receive a response
      const requestPromise = new Promise<FetchResult>((resolve, reject) => {
        console.log('🔄 DEBUG: executeFetch (frontend) - Setting up promise for request ID:', requestId);
        pendingRequestsRef.current.set(requestId, { resolve, reject });

        // Send the request to the background script
        const message = {
          type: 'EXECUTE_FETCH',
          url,
          options: options ?? {},
          requestId,
        };
        console.log('📤 DEBUG: executeFetch (frontend) - Sending message to background:', message);
        portRef.current?.postMessage(message);

        // Set a timeout to reject the promise if we don't get a response
        setTimeout(() => {
          if (pendingRequestsRef.current.has(requestId)) {
            console.log('⏰ DEBUG: executeFetch (frontend) - Request timed out for ID:', requestId);
            pendingRequestsRef.current.delete(requestId);
            reject(new Error('Request timed out'));
          }
        }, 30000); // 30 second timeout
      });

      console.log('⏳ DEBUG: executeFetch (frontend) - Waiting for response...');
      // Wait for the response
      const result = await requestPromise;
      console.log('✅ DEBUG: executeFetch (frontend) - Received response:', result);
      return result;
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
