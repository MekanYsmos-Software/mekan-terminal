import { useCallback, useState } from 'react';
import { useTerminal } from './useTerminal';
import { useTerminalsStore } from '../../stores/terminals';
import type { TerminalStatus, SplitDirection } from '@shared/types';

interface Props {
  terminalId: string;
  projectId: string;
  cwd: string;
}

export default function TerminalPane({ terminalId, projectId, cwd }: Props) {
  const [status, setStatus] = useState<TerminalStatus>('running');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const { splitPane, closePane, getTerminalCount } = useTerminalsStore();
  const terminal = useTerminalsStore((s) => (s.terminals[projectId] || []).find((t) => t.id === terminalId));

  const onStatusChange = useCallback(
    (newStatus: 'running' | 'exited', code: number | null) => {
      setStatus(newStatus);
      setExitCode(code);
      useTerminalsStore.getState().updateStatus(projectId, terminalId, newStatus, code);
    },
    [projectId, terminalId]
  );

  const { containerRef } = useTerminal({ terminalId, onStatusChange });

  const canSplit = getTerminalCount(projectId) < 6;
  const shellLabel = terminal?.shell === 'pwsh' ? 'PS' : terminal?.shell === 'wsl' ? 'WSL' : 'CMD';

  function handleSplit(direction: SplitDirection) {
    splitPane(projectId, terminalId, direction, cwd, terminal?.shell);
  }

  function handleClose() {
    closePane(projectId, terminalId);
  }

  async function handleRestart() {
    const newId = await useTerminalsStore.getState().restartTerminal(terminalId);
    if (newId) {
      setStatus('running');
      setExitCode(null);
    }
  }

  const statusColor = status === 'running' ? 'bg-status-running' : status === 'exited' ? 'bg-status-exited' : 'bg-status-idle';

  return (
    <div className="flex flex-col h-full w-full" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="flex items-center h-7 px-2 bg-surface-2 border-b border-zinc-800 gap-2 flex-shrink-0">
        <div className={`w-2 h-2 rounded-full ${statusColor}`} title={status === 'exited' ? `Exit code: ${exitCode}` : status} />
        <span className="text-xxs text-accent font-mono">{shellLabel}</span>
        <span className="text-xxs text-zinc-600 flex-1 truncate">{cwd.split('\\').pop()}</span>
        {hovered && (
          <div className="flex items-center gap-1">
            {status === 'exited' && (
              <button onClick={handleRestart} className="text-xxs text-zinc-500 hover:text-white px-1" title="Restart">
                ↻
              </button>
            )}
            {canSplit && (
              <>
                <button onClick={() => handleSplit('horizontal')} className="text-xxs text-zinc-500 hover:text-white px-1" title="Split horizontal">
                  ⬒
                </button>
                <button onClick={() => handleSplit('vertical')} className="text-xxs text-zinc-500 hover:text-white px-1" title="Split vertical">
                  ⬓
                </button>
              </>
            )}
            <button onClick={handleClose} className="text-xxs text-zinc-500 hover:text-red-400 px-1" title="Close">
              ✕
            </button>
          </div>
        )}
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
