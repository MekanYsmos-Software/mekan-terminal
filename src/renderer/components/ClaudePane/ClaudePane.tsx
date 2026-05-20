import { useEffect, useRef, useState } from 'react';
import { useClaudeStore } from '../../stores/claude';
import MessageBubble from './MessageBubble';
import type { ClaudeMessage } from '@shared/types';

interface Props {
  terminalId: string;
  projectId: string;
  cwd: string;
}

export default function ClaudePane({ terminalId, projectId, cwd }: Props) {
  const session = useClaudeStore((s) => s.sessions[terminalId]);
  const initSession = useClaudeStore((s) => s.initSession);
  const addUserMessage = useClaudeStore((s) => s.addUserMessage);
  const handleEvent = useClaudeStore((s) => s.handleEvent);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!session) {
      initSession(terminalId, terminalId);
    }

    const unsub = window.mekan.claude.onEvent(terminalId, (event) => {
      handleEvent(terminalId, event);
    });
    cleanupRef.current = unsub;

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [terminalId]);

  useEffect(() => {
    if (!userScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.messages, session?.currentText, userScrolled]);

  function handleScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setUserScrolled(!nearBottom);
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !session || session.streaming) return;
    addUserMessage(terminalId, trimmed);
    window.mekan.claude.send(terminalId, trimmed);
    setInput('');
    setUserScrolled(false);
    setTimeout(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }, 0);
  }

  function handleAbort() {
    window.mekan.claude.abort(terminalId);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-zinc-600 text-sm">
          <div className="text-lg mb-1">Claude Code</div>
          <div className="text-xs">Send a message to start</div>
        </div>
      </div>
    );
  }

  const streamingMessage: ClaudeMessage | null = session.streaming && session.currentText
    ? {
        id: 'streaming',
        role: 'assistant',
        content: session.currentText,
        toolUse: session.currentToolUse.length > 0 ? session.currentToolUse : undefined,
        timestamp: new Date().toISOString(),
        partial: true,
      }
    : null;

  return (
    <div className="flex flex-col h-full">
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 min-h-0"
        onScroll={handleScroll}
      >
        {session.messages.length === 0 && !streamingMessage && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center text-zinc-600 text-sm">
              <div className="text-lg mb-1">Claude Code</div>
              <div className="text-xs">Send a message to start</div>
            </div>
          </div>
        )}
        {session.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {streamingMessage && <MessageBubble message={streamingMessage} />}
        {session.streaming && !session.currentText && (
          <div className="flex items-center gap-1.5 py-2 text-zinc-500">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 border-t border-border bg-surface-1 px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-surface-2 text-sm text-zinc-200 placeholder-zinc-600 rounded-lg px-3 py-2 outline-none border border-border focus:border-accent/50 resize-none transition-colors"
            disabled={session.streaming}
          />
          {session.streaming ? (
            <button
              onClick={handleAbort}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              title="Cancel"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="1" y="1" width="8" height="8" rx="1" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Send (Enter)"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
