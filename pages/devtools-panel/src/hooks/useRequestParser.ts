type UseFetchParserReturn = {
  extractHttpMethod: (fetchCode: string) => string | undefined;
  extractUrlPath: (fetchCode: string) => string | null;
  extractFetchDetails: (fetchCode: string) => { url: string | null; options: string | null };
};

/**
 * Custom hook for parsing fetch commands
 */
export const useFetchParser = (): UseFetchParserReturn => {
  /**
   * Extract HTTP method from fetch code
   */
  const extractHttpMethod = (fetchCode: string): string | undefined => {
    try {
      const methodMatch = fetchCode.match(/method["']?:\s*["']([A-Z]+)["']/i);
      if (methodMatch && methodMatch[1]) {
        return methodMatch[1].toUpperCase();
      }
      return 'GET';
    } catch {
      return;
    }
  };

  /**
   * Extract the last part of the URL path
   */
  const extractUrlPath = (fetchCode: string): string | null => {
    try {
      let urlMatch = fetchCode.match(/fetch\("([^"]+)"/);
      if (!urlMatch) {
        urlMatch = fetchCode.match(/fetch\('([^']+)'/);
      }

      if (urlMatch && urlMatch[1]) {
        const url = urlMatch[1];

        try {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname;

          if (pathname === '/' || pathname === '') {
            return null;
          }

          const pathParts = pathname.split('/');
          const lastPart = pathParts.filter(part => part.length > 0).pop();

          if (lastPart && lastPart.length > 0) {
            return lastPart;
          }
        } catch {
          const pathParts = url.split('/');
          let lastPart = pathParts.filter(part => part.length > 0).pop();

          if (lastPart && lastPart.includes('?')) {
            lastPart = lastPart.split('?')[0];
          }

          if (lastPart && lastPart.length > 0 && !lastPart.includes('.')) {
            return lastPart;
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error extracting URL path:', error);
      return null;
    }
  };

  /**
   * Extract URL and options from fetch code
   * (improved with multiple regex patterns, including backticks)
   */
  const extractFetchDetails = (fetchCode: string): { url: string | null; options: string | null } => {
    try {
      let extractedUrl = '';
      let extractedOptions = '';

      // Match URL inside fetch call - support "", '', and ``
      let urlMatch = fetchCode.match(/fetch\s*\(\s*["']([^"']+)["']/);

      if (!urlMatch) {
        urlMatch = fetchCode.match(/fetch\s*\(\s*`([^`]+)`/);
      }

      if (urlMatch && urlMatch[1]) {
        extractedUrl = urlMatch[1];
      }

      // Extract fetch options more robustly
      const optionsPattern = /fetch\s*\(['"`][^'"`]+['"`]\s*,\s*({[\s\S]*?})\s*\)/;
      const optionsMatch = fetchCode.match(optionsPattern);

      if (optionsMatch && optionsMatch[1]) {
        extractedOptions = optionsMatch[1];
      }

      return { url: extractedUrl, options: extractedOptions };
    } catch (error) {
      console.error('Error extracting URL and options:', error);
    }
    return { url: null, options: null };
  };

  return {
    extractHttpMethod,
    extractUrlPath,
    extractFetchDetails,
  };
};
