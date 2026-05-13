import { useProjectsStore } from '../../stores/projects';
import { useTerminalsStore } from '../../stores/terminals';
import TerminalPane from '../TerminalPane/TerminalPane';

interface Props {
  open: boolean;
  onClose(): void;
}

export default function ServerTerminalPopup({ open, onClose }: Props) {
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const allTerminals = useTerminalsStore((s) => s.terminals);
  const serverTerminal = activeProjectId
    ? (allTerminals[activeProjectId] ?? []).find((t) => t.isServer)
    : undefined;

  if (!open || !activeProjectId || !serverTerminal) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 flex flex-col animate-slide-up" style={{ height: '45%' }}>
      <div className="flex items-center h-8 px-3 bg-surface-2 border-t border-border flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]" />
          <span className="text-xxs text-green-400/80 font-semibold tracking-wide">SERVER</span>
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-surface-3 transition-all"
          title="Close popup"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
      <div className="flex-1 min-h-0 bg-surface-0">
        <TerminalPane
          terminalId={serverTerminal.id}
          projectId={activeProjectId}
          cwd={serverTerminal.cwd}
          hideHeader
        />
      </div>
    </div>
  );
}
