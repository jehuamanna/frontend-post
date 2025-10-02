import { parseCurlAdvanced } from '../lib/curlToFetch';

type UseFetchParserReturn = {
  extractHttpMethod: (fetchCode: string) => string | undefined;
  extractUrlPath: (fetchCode: string) => string | null;
  extractFetchDetails: (fetchCode: string) => { url: string | null; options: string | null };
  isCurl: (text: string) => boolean;
  isFetch: (text: string) => boolean;
  isJson: (text: string) => boolean;
  detectLanguage: (text: string) => 'bash' | 'javascript' | 'json' | 'plaintext';
};

/**
 * Custom hook for parsing fetch commands
 */
export const useFetchParser = (): UseFetchParserReturn => {
  const isCurl = (text: string) => /^\s*curl\b/i.test((text ?? '').trim());
  const isFetch = (text: string) => /(\bfetch\s*\(|\baxios\s*\(|\bawait\s+fetch\s*\(|\.then\s*\()/i.test(text ?? '');
  const isJson = (text: string) => {
    const t = (text ?? '').trim();
    if (!t) return false;
    if (!((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']')))) return false;
    try { JSON.parse(t); return true; } catch { return false; }
  };
  const detectLanguage = (text: string): 'bash' | 'javascript' | 'json' | 'plaintext' => {
    if (isCurl(text)) return 'bash';
    if (isFetch(text)) return 'javascript';
    if (isJson(text)) return 'json';
    return 'plaintext';
  };

  // Use robust curl parser from lib
  // Import placed at top-level to satisfy module resolution
  // Note: Type import at top of file is not needed here; we only consume function output
  const parseCurl = (curlCommand: string): { url: string; options: Record<string, unknown> } => {
    const parsed = parseCurlAdvanced(String(curlCommand || ''));
    return { url: parsed.url, options: parsed.options };
  };
  /**
   * Extract HTTP method from fetch code
   */
  const extractHttpMethod = (fetchCode: string): string | undefined => {
    try {
      if (isCurl(fetchCode)) {
        const { options } = parseCurl(fetchCode);
        const m = String((options as any).method ?? 'GET').toUpperCase();
        return m;
      }
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
      if (isCurl(fetchCode)) {
        const { url } = parseCurl(fetchCode);
        if (!url) return null;
        try {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname;
          if (pathname === '/' || pathname === '') return null;
          const pathParts = pathname.split('/');
          const lastPart = pathParts.filter(part => part.length > 0).pop();
          return lastPart ?? null;
        } catch {
          const pathParts = url.split('/');
          let lastPart = pathParts.filter(part => part.length > 0).pop();
          if (lastPart && lastPart.includes('?')) lastPart = lastPart.split('?')[0];
          if (lastPart && lastPart.length > 0 && !lastPart.includes('.')) return lastPart;
          return null;
        }
      }
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
      if (isCurl(fetchCode)) {
        const { url, options } = parseCurl(fetchCode);
        return { url, options: JSON.stringify(options, null, 2) };
      }
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
    isCurl,
    isFetch,
    isJson,
    detectLanguage,
  };
};
