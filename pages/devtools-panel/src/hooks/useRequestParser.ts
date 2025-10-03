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
        // For curl, parseCurlAdvanced already infers POST when a body exists
        return m;
      }
      // Detect explicit method in fetch/axios options
      const methodMatch = fetchCode.match(/method["']?\s*:\s*["']([a-zA-Z]+)["']/i);
      if (methodMatch && methodMatch[1]) {
        return methodMatch[1].toUpperCase();
      }

      // If options object exists and contains a body, infer POST
      const optionsPattern = /fetch\s*\(\s*[^,]+,\s*({[\s\S]*?})\s*\)/i;
      const optionsMatch = fetchCode.match(optionsPattern);
      if (optionsMatch && optionsMatch[1]) {
        const optsText = optionsMatch[1];
        if (/\bbody\s*:/i.test(optsText)) {
          return 'POST';
        }
      }

      // No reliable method detected
      return undefined;
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
    console.log('🔍 DEBUG: extractFetchDetails - Function entered with code:', fetchCode.substring(0, 100) + '...');
    try {
      if (isCurl(fetchCode)) {
        console.log('🐚 DEBUG: extractFetchDetails - Detected curl command');
        const { url, options } = parseCurl(fetchCode);
        console.log('🐚 DEBUG: extractFetchDetails - Parsed curl result:', { url, options });
        return { url, options: JSON.stringify(options, null, 2) };
      }
      console.log('🌐 DEBUG: extractFetchDetails - Processing as fetch request');
      let extractedUrl = '';
      let extractedOptions = '';

      // Match URL inside fetch call - support "", '', and ``
      let urlMatch = fetchCode.match(/fetch\s*\(\s*["']([^"']+)["']/);

      if (!urlMatch) {
        urlMatch = fetchCode.match(/fetch\s*\(\s*`([^`]+)`/);
      }

      if (urlMatch && urlMatch[1]) {
        extractedUrl = urlMatch[1];
        console.log('🌐 DEBUG: extractFetchDetails - Extracted URL:', extractedUrl);
      }

      // Extract fetch options more robustly - handle multiline and nested objects
      const optionsPattern = /fetch\s*\(\s*['"`][^'"`]+['"`]\s*,\s*({[\s\S]*})\s*\)/;
      const optionsMatch = fetchCode.match(optionsPattern);
      console.log('⚙️ DEBUG: extractFetchDetails - Options pattern match:', !!optionsMatch);

      if (optionsMatch && optionsMatch[1]) {
        let optionsText = optionsMatch[1];
        console.log('⚙️ DEBUG: extractFetchDetails - Raw options text:', optionsText.substring(0, 200) + '...');
        
        // Handle nested braces by counting them
        let braceCount = 0;
        let endIndex = 0;
        for (let i = 0; i < optionsText.length; i++) {
          if (optionsText[i] === '{') braceCount++;
          if (optionsText[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
        }
        
        if (endIndex > 0) {
          extractedOptions = optionsText.substring(0, endIndex);
        } else {
          extractedOptions = optionsText;
        }
        console.log('⚙️ DEBUG: extractFetchDetails - Final extracted options:', extractedOptions);
      }

      const result = { url: extractedUrl, options: extractedOptions };
      console.log('✅ DEBUG: extractFetchDetails - Function completed with result:', result);
      return result;
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
