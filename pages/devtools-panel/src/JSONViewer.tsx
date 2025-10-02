// JSONLineEditor.tsx
import { useEffect, useMemo, useState } from 'react';

interface Props {
  jsonString: string;
  className?: string;
  onChange?: (newJson: string) => void;
}

/**
 * Minimal JSON line-by-line viewer.
 * - Font size 9px monospace
 * - Left aligned (no pyramid/center alignment issue)
 * - White/grey theme
 * - Click line to inspect key/value
 */
export default function JSONLineEditor({ jsonString = '', className = '', onChange }: Props) {
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [toastTimer, setToastTimer] = useState<number | null>(null);

  // Format JSON with indentation; fallback to raw
  const formatted = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  }, [jsonString]);

  // Keep local editable text in sync when not editing
  useEffect(() => {
    if (!isEditing) setText(formatted);
  }, [formatted, isEditing]);

  const lines = useMemo(() => formatted.split(/\r?\n/), [formatted]);

  const showToast = (message: string, type: 'success' | 'error' = 'success', duration = 1800) => {
    setToast({ message, type });
    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }
    const id = window.setTimeout(() => setToast(null), duration);
    setToastTimer(id);
  };

  const handleExitEdit = () => {
    // Try to parse and pretty-print; keep raw if invalid
    let next = text;
    let parsedOk = true;
    try {
      const parsed = JSON.parse(text);
      next = JSON.stringify(parsed, null, 2);
    } catch {
      // leave as-is if not valid JSON
      parsedOk = false;
    }
    // Debug: confirm save firing on blur
    try { console.debug('[JSONViewer] Saving JSON on blur'); } catch {}
    setText(next);
    setIsEditing(false);
    if (onChange) onChange(next);
    // Toast feedback
    if (parsedOk) {
      showToast('Saved', 'success');
    } else {
      showToast('Parse error: saved as plain text', 'error');
    }
  };

  const handleKeyDownEdit: React.KeyboardEventHandler<HTMLTextAreaElement> = e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExitEdit();
    }
    // ESC to cancel edits and revert to formatted
    if (e.key === 'Escape') {
      e.preventDefault();
      setText(formatted);
      setIsEditing(false);
    }
  };

  return (
    <div className={`w-full max-w-full ${className}`}>
      {/* Main viewer */}
      <div className="relative overflow-auto rounded border border-gray-200 bg-white shadow-sm" style={{ maxHeight: '60vh' }}>
        {!isEditing ? (
          <div
            className="text-left font-mono text-xs leading-snug"
            onDoubleClick={() => setIsEditing(true)}
            role="button"
            tabIndex={0}
            aria-label="Double click to edit JSON"
          >
            {lines.map((line, i) => (
              <div
                key={i}
                className={`flex items-start ${selectedLine === i ? 'bg-gray-50' : ''}`}
                onClick={() => setSelectedLine(i)}
                onKeyDown={e => e.key === 'Enter' && setSelectedLine(i)}
                role="button"
                tabIndex={0}
                aria-label={`Select line ${i + 1}`}
              >
                {/* Line number */}
                <div className={`select-none border-r border-gray-100 px-2 py-[1px] text-gray-500 ${selectedLine === i ? 'bg-gray-100' : ''}`} style={{ minWidth: 40 }}>
                  {i + 1}
                </div>
                {/* Content with word wrap */}
                <div className="flex-1 whitespace-pre-wrap break-words px-2 py-[1px] text-gray-800">
                  {line}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2">
            <textarea
              className="h-[56vh] w-full resize-none rounded border border-gray-200 bg-white p-2 font-mono text-xs leading-snug outline-none whitespace-pre-wrap break-words"
              value={text}
              onChange={e => setText(e.target.value)}
              onBlur={handleExitEdit}
              onKeyDown={handleKeyDownEdit}
              autoFocus
              spellCheck={false}
              aria-label="JSON editor"
            />
            <div className="mt-1 flex items-center justify-start text-[10px] text-gray-500">
              <div>Press Ctrl/Cmd+Enter to save. Esc to cancel. Blur to save.</div>
            </div>
          </div>
        )}
        {/* Toast */}
        {toast && (
          <div
            className={`pointer-events-none absolute bottom-2 right-2 rounded px-2 py-1 text-[11px] shadow-sm ${
              toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        )}
      </div>
      
    </div>
  );
}
