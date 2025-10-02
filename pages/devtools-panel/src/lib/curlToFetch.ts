export type ParsedCurl = {
  url: string;
  options: Record<string, unknown>;
  fetchCode: string;
};

/**
 * Robustly convert a curl command into fetch URL, options, and sample code.
 * - Handles quoting, multiple headers, cookies, data flags, referer, user-agent, redirects.
 * - Normalizes and strips forbidden browser headers.
 */
export function parseCurlAdvanced(curlCommand: string): ParsedCurl {
  // Normalize line continuations and trim
  const normalized = (curlCommand || '')
    .replace(/\\\r?\n/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim();

  // Simple tokenizer that respects single/double quotes
  const tokens: string[] = [];
  {
    let i = 0;
    while (i < normalized.length) {
      while (i < normalized.length && /\s/.test(normalized[i]!)) i++;
      if (i >= normalized.length) break;

      if (normalized[i] === "'" || normalized[i] === '"') {
        const quote = normalized[i++]!;
        let buf = '';
        while (i < normalized.length) {
          const ch = normalized[i]!;
          if (ch === '\\' && quote === '"' && i + 1 < normalized.length) {
            buf += normalized[i + 1]!;
            i += 2;
            continue;
          }
          if (ch === quote) { i++; break; }
          buf += ch;
          i++;
        }
        tokens.push(buf);
      } else {
        const start = i;
        while (i < normalized.length && !/\s/.test(normalized[i]!)) i++;
        tokens.push(normalized.slice(start, i));
      }
    }
  }

  if (!tokens.length || tokens[0] !== 'curl') {
    // Fallback to empty if not a curl
    return { url: '', options: {}, fetchCode: '/* Not a curl command */' };
  }

  // State
  let url = '';
  let method = '';
  const headers: Record<string, string> = {};
  const dataParts: string[] = [];
  const dataUrlencodeParts: string[] = [];
  let referer: string | undefined;
  let userAgent: string | undefined;
  let follow = false;
  let hasCookiesFlag = false;
  let cookieString = '';
  let compressed = false;

  const setHeader = (k: string, v: string) => {
    const key = String(k).trim();
    const value = String(v).trim();
    if (!key) return;
    headers[key] = value;
  };

  // Iterate tokens
  for (let idx = 1; idx < tokens.length; idx++) {
    const t = tokens[idx]!;

    // URL position arg (first non-flag)
    if (!t.startsWith('-') && !url) {
      url = t;
      continue;
    }

    switch (t) {
      case '--url':
        url = tokens[++idx] || url;
        break;
      case '-X':
      case '--request':
        method = (tokens[++idx] || '').toUpperCase();
        break;
      case '-H':
      case '--header': {
        const hv = tokens[++idx] || '';
        const colonIndex = hv.indexOf(':');
        if (colonIndex > -1) {
          const k = hv.slice(0, colonIndex).trim();
          const v = hv.slice(colonIndex + 1).trim();
          setHeader(k, v);
        }
        break;
      }
      case '-b':
      case '--cookie': {
        hasCookiesFlag = true;
        cookieString = tokens[++idx] || cookieString;
        break;
      }
      case '-A':
      case '--user-agent':
        userAgent = tokens[++idx] || userAgent;
        break;
      case '-e':
      case '--referer':
        referer = tokens[++idx] || referer;
        break;
      case '-L':
      case '--location':
        follow = true;
        break;
      case '--compressed':
        compressed = true; // informational
        break;
      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-binary': {
        const d = tokens[++idx] || '';
        dataParts.push(d);
        break;
      }
      case '--data-urlencode': {
        const d = tokens[++idx] || '';
        const eqIdx = d.indexOf('=');
        if (eqIdx === -1) {
          dataUrlencodeParts.push(encodeURIComponent(d));
        } else {
          const k = d.slice(0, eqIdx);
          const v = d.slice(eqIdx + 1);
          dataUrlencodeParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
        }
        break;
      }
      default: {
        if (!url && !t.startsWith('-')) {
          url = t;
        }
        break;
      }
    }
  }

  // Build body
  let body: string | null = null;
  let hasExplicitContentType = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');

  if (dataUrlencodeParts.length) {
    const form = dataUrlencodeParts.join('&');
    body = form;
    if (!hasExplicitContentType) {
      setHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
      hasExplicitContentType = true;
    }
  }

  if (dataParts.length) {
    const joined = dataParts.join('&');
    const ctEntry = Object.entries(headers).find(([k]) => k.toLowerCase() === 'content-type');
    const contentType = (ctEntry?.[1] || '').toLowerCase();
    const looksJson = joined.trim().startsWith('{') || joined.trim().startsWith('[');

    if (contentType.includes('application/json') || looksJson) {
      body = joined;
      if (!hasExplicitContentType) {
        setHeader('Content-Type', 'application/json;charset=UTF-8');
        hasExplicitContentType = true;
      }
    } else if (contentType.includes('application/x-www-form-urlencoded') || body === null) {
      body = body ? `${body}&${joined}` : joined;
      if (!hasExplicitContentType) {
        setHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
        hasExplicitContentType = true;
      }
    } else {
      body = joined; // raw payload
    }
  }

  if (!method) {
    method = body != null ? 'POST' : 'GET';
  }

  // Normalize headers: drop forbidden/UA-managed
  const forbidden = new Set([
    'accept-encoding',
    'content-length',
    'host',
    'connection',
    'keep-alive',
    'proxy-connection',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'sec-fetch-dest',
    'sec-fetch-mode',
    'sec-fetch-site',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
    ':authority',
    ':method',
    ':path',
    ':scheme',
  ]);

  const normalizedHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const lk = k.toLowerCase();
    if (forbidden.has(lk)) continue;
    if (lk === 'origin') continue; // browser sets this
    if (lk === 'referer') { if (!referer) referer = v; continue; }
    if (lk === 'user-agent') { if (!userAgent) userAgent = v; continue; }
    normalizedHeaders[k] = v;
  }

  if (cookieString) {
    normalizedHeaders['Cookie'] = cookieString;
  }

  const options: Record<string, unknown> = { method, headers: normalizedHeaders };
  if (referer) (options as any).referrer = referer;
  if (follow) (options as any).redirect = 'follow';
  if (body != null) (options as any).body = body;
  if (hasCookiesFlag || 'Cookie' in normalizedHeaders) (options as any).credentials = 'include';
  if (userAgent) {
    (options.headers as Record<string, string>)['User-Agent'] = userAgent;
  }

  const fetchCode =
    `fetch(${JSON.stringify(url)}` +
    `${Object.keys(options).length ? `, ${JSON.stringify(options, null, 2)}` : ''})\n` +
    `  .then(res => {\n` +
    `    const ct = res.headers.get('content-type') || '';\n` +
    `    return ct.includes('application/json') ? res.json() : res.text();\n` +
    `  })\n` +
    `  .then(console.log)\n` +
    `  .catch(console.error);`;

  return { url, options, fetchCode };
}
