import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { ClaudeMessage } from '@shared/types';
import ToolUseBlock from './ToolUseBlock';

interface Props {
  message: ClaudeMessage;
}

export default function MessageBubble({ message }: Props) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] bg-surface-2 rounded-lg px-3 py-2 text-sm text-zinc-200 whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <div className="text-sm text-zinc-300 claude-markdown">
        <ReactMarkdown
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const code = String(children).replace(/\n$/, '');
              if (match) {
                return (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: '0.5rem 0',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      background: 'var(--color-surface-2, #1a1a1e)',
                    }}
                  >
                    {code}
                  </SyntaxHighlighter>
                );
              }
              return (
                <code className="bg-surface-2 px-1.5 py-0.5 rounded text-xs text-accent font-mono" {...props}>
                  {children}
                </code>
              );
            },
            p({ children }) {
              return <p className="mb-2 leading-relaxed">{children}</p>;
            },
            ul({ children }) {
              return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
            },
            ol({ children }) {
              return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
            },
            h1({ children }) {
              return <h1 className="text-base font-semibold text-zinc-100 mb-2 mt-3">{children}</h1>;
            },
            h2({ children }) {
              return <h2 className="text-sm font-semibold text-zinc-100 mb-2 mt-3">{children}</h2>;
            },
            h3({ children }) {
              return <h3 className="text-sm font-medium text-zinc-200 mb-1 mt-2">{children}</h3>;
            },
            blockquote({ children }) {
              return <blockquote className="border-l-2 border-accent/30 pl-3 my-2 text-zinc-400 italic">{children}</blockquote>;
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      {message.toolUse?.map((entry, i) => (
        <ToolUseBlock key={i} entry={entry} />
      ))}
    </div>
  );
}
