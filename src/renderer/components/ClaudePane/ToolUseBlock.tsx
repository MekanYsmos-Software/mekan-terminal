import { useState } from 'react';
import type { ToolUseEntry } from '@shared/types';

interface Props {
  entry: ToolUseEntry;
}

export default function ToolUseBlock({ entry }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1.5 rounded-md border border-border bg-surface-1 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-surface-2 transition-colors"
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="none"
          className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <path d="M2 1L6 4L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-mono text-xxs text-accent/70">{entry.tool}</span>
        <span className="truncate">{entry.summary}</span>
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-2 text-xxs font-mono text-zinc-500 max-h-60 overflow-auto">
          {entry.output ? (
            <pre className="whitespace-pre-wrap break-all">{entry.output.slice(0, 2000)}</pre>
          ) : (
            <pre className="whitespace-pre-wrap break-all text-zinc-600">
              {JSON.stringify(entry.input, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
