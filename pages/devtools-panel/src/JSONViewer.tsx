// JSONLineEditor.tsx
import { useMemo, useState } from 'react';

interface Props {
  jsonString: string;
  className?: string;
}

/**
 * Minimal JSON line-by-line viewer.
 * - Font size 9px monospace
 * - Left aligned (no pyramid/center alignment issue)
 * - White/grey theme
 * - Click line to inspect key/value
 */
export default function JSONLineEditor({ jsonString = '', className = '' }: Props) {
  const [selectedLine, setSelectedLine] = useState<number | null>(null);

  // Format JSON with indentation; fallback to raw
  const formatted = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  }, [jsonString]);

  const lines = useMemo(() => formatted.split(/\r?\n/), [formatted]);

  // Regex: detect "key": value
  const extractKeyValue = (lineText: string) => {
    const kvRegex = /^\s*"([^"]+)"\s*:\s*(.+?)(,?\s*)$/;
    const m = lineText.match(kvRegex);
    if (!m) return null;
    const [, key, rawValue] = m;
    const value = rawValue.replace(/,\s*$/, '').trim();
    return { key, value };
  };

  const selectedInfo =
    selectedLine != null
      ? {
          lineNumber: selectedLine + 1,
          text: lines[selectedLine],
          kv: extractKeyValue(lines[selectedLine]),
        }
      : null;

  return (
    <div className={`w-full max-w-full ${className}`}>
      {/* Main viewer */}
      <div className="overflow-auto rounded border border-gray-200 bg-white shadow-sm" style={{ maxHeight: '60vh' }}>
        <div className="flex text-left font-mono text-xs leading-snug">
          {/* Line numbers */}
          <div className="select-none border-r border-gray-100 text-gray-500" style={{ minWidth: 40 }}>
            {lines.map((_, i) => (
              <div
                key={i}
                className={`px-2 py-[1px] ${selectedLine === i ? 'bg-gray-100' : ''}`}
                onClick={() => setSelectedLine(i)}
                onKeyDown={e => e.key === 'Enter' && setSelectedLine(i)}
                role="button"
                tabIndex={0}
                aria-label={`Select line ${i + 1}`}>
                {i + 1}
              </div>
            ))}
          </div>

          {/* JSON code */}
          <div className="flex-1">
            {lines.map((line, i) => (
              <div
                key={i}
                className={`cursor-pointer whitespace-pre px-2 py-[1px] text-gray-800 ${
                  selectedLine === i ? 'bg-gray-50' : ''
                }`}
                onClick={() => setSelectedLine(i)}
                onKeyDown={e => e.key === 'Enter' && setSelectedLine(i)}
                role="button"
                tabIndex={0}
                aria-label={`Select line ${i + 1}`}>
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inspector */}
      <div className="mt-2 font-sans text-xs">
        {selectedInfo ? (
          <div className="rounded border border-gray-100 bg-white p-2 text-gray-700">
            <div className="mb-1 text-xs text-gray-500">Line {selectedInfo.lineNumber}</div>

            <div className="mb-1">
              <div className="break-words rounded border border-gray-50 bg-gray-50 p-1 font-mono text-xs">
                {selectedInfo.text}
              </div>
            </div>

            {selectedInfo.kv ? (
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center">
                  <span className="mr-2 text-gray-500">Key:</span>
                  <span className="font-mono">{selectedInfo.kv.key}</span>
                </div>
                <div className="flex items-start">
                  <span className="mr-2 text-gray-500">Value:</span>
                  <pre className="m-0 whitespace-pre-wrap break-words font-mono">{selectedInfo.kv.value}</pre>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500">No key/value detected on this line.</div>
            )}
          </div>
        ) : (
          <div className="text-xs text-gray-500">Click a line to inspect key/value.</div>
        )}
      </div>
    </div>
  );
}
