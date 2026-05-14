import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Project, ProjectTask } from '@shared/types';
import { useTerminalsStore } from '../../stores/terminals';
import { useProjectsStore } from '../../stores/projects';
import { useTasksStore } from '../../stores/tasks';
import { useGitStore } from '../../stores/git';

const EMPTY_TASKS: ProjectTask[] = [];

interface Props {
  project: Project;
  active: boolean;
  notified: boolean;
  onClick(): void;
  onRename(name: string): void;
  onRemove(): void;
  onToggleServer(): void;
  serverPopupOpen: boolean;
}

export default function ProjectItem({ project, active, notified, onClick, onRename, onRemove, onToggleServer, serverPopupOpen }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editingServer, setEditingServer] = useState(false);
  const [serverCmd, setServerCmd] = useState(project.serverCommand || '');
  const [editingGitUser, setEditingGitUser] = useState(false);
  const [gitName, setGitName] = useState('');
  const [gitEmail, setGitEmail] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const serverInputRef = useRef<HTMLInputElement>(null);
  const gitNameRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const allTerminals = useTerminalsStore((s) => s.terminals);
  const savedCounts = useTerminalsStore((s) => s.savedCounts);
  const projectTerminals = allTerminals[project.id] ?? [];
  const nonServerTerminals = projectTerminals.filter((t) => !t.isServer);
  const hasLiveTerminals = project.id in allTerminals;
  const terminalCount = hasLiveTerminals ? nonServerTerminals.length : (savedCounts[project.id] || 0);
  const busyCount = nonServerTerminals.filter((t) => t.busy).length;
  const waitingCount = nonServerTerminals.filter((t) => t.waiting && !t.busy).length;
  const serverTerminals = projectTerminals.filter((t) => t.isServer);
  const spawnTerminal = useTerminalsStore((s) => s.spawnTerminal);
  const worktrees = useGitStore((s) => s.worktrees);
  const removeTerminal = useTerminalsStore((s) => s.removeTerminal);
  const setServerCommand = useProjectsStore((s) => s.setServerCommand);
  const setLogo = useProjectsStore((s) => s.setLogo);
  const clearLogo = useProjectsStore((s) => s.clearLogo);
  const projectTasks = useTasksStore((s) => s.tasks[project.id] ?? EMPTY_TASKS);
  const loadTasks = useTasksStore((s) => s.loadTasks);
  const pendingTasks = projectTasks.filter((t) => t.status !== 'done').length;
  const doneTasks = projectTasks.filter((t) => t.status === 'done').length;

  useEffect(() => {
    loadTasks(project.id);
  }, [project.id, loadTasks]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  useEffect(() => {
    if (editingServer && serverInputRef.current) serverInputRef.current.focus();
  }, [editingServer]);

  useEffect(() => {
    if (editingGitUser && gitNameRef.current) gitNameRef.current.focus();
  }, [editingGitUser]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const initial = project.name.charAt(0).toUpperCase();

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  }

  function commitRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== project.name) {
      onRename(trimmed);
    }
    setEditing(false);
  }

  function commitServerCommand() {
    const trimmed = serverCmd.trim();
    setServerCommand(project.id, trimmed);
    setEditingServer(false);
  }

  async function openGitUserEdit() {
    const user = await window.mekan.git.getUser(project.path);
    setGitName(user.name);
    setGitEmail(user.email);
    setEditingGitUser(true);
  }

  async function commitGitUser() {
    await window.mekan.git.setUser(project.path, gitName.trim(), gitEmail.trim());
    setEditingGitUser(false);
  }

  async function handleServerClick() {
    if (!project.serverCommand) return;
    const mainServer = serverTerminals.find((t) => t.cwd.replace(/\\/g, '/').toLowerCase() === project.path.replace(/\\/g, '/').toLowerCase());
    if (!mainServer) {
      const mainWorktree = worktrees.find((wt) => wt.isMain);
      const branchName = mainWorktree?.branch || undefined;
      const id = await spawnTerminal(project.id, project.path, undefined, true, branchName);
      if (id) {
        setTimeout(() => {
          window.mekan.terminal.write(id, project.serverCommand + '\r');
        }, 500);
      }
    }
    onToggleServer();
  }

  function handleStopAllServers(e: React.MouseEvent) {
    e.stopPropagation();
    for (const st of serverTerminals) {
      removeTerminal(project.id, st.id);
    }
  }

  const hasRunningServers = serverTerminals.some((t) => t.status === 'running');

  return (
    <div
      className={`group relative flex flex-wrap items-start gap-x-2.5 gap-y-0 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
        active
          ? 'bg-surface-3/80 text-white shadow-subtle ring-1 ring-accent/20'
          : notified
            ? 'bg-amber-500/5 text-zinc-300 ring-1 ring-amber-500/30 hover:bg-amber-500/10'
            : 'text-zinc-400 hover:bg-surface-2/60 hover:text-zinc-200'
      }`}
      onClick={onClick}
      onContextMenu={handleContextMenu}
    >
      {project.logo ? (
        <img src={`file://${project.logo}`} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
      ) : (
        <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors duration-200 ${
          active ? 'bg-accent/25 text-accent' : 'bg-surface-3 text-zinc-500'
        }`}>
          {initial}
        </div>
      )}
      <div className="flex-1 min-w-0 pt-0.5">
        {editing ? (
          <input
            ref={inputRef}
            className="w-full bg-surface-3 text-white text-sm px-1.5 py-0.5 rounded-md outline-none border border-accent/50 focus:border-accent focus:shadow-glow-sm transition-all"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <div className="text-sm font-medium truncate leading-tight flex items-center gap-1.5">
            {project.name}
            {notified && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" title="Terminal finished" />}
          </div>
        )}
        {editingServer ? (
          <input
            ref={serverInputRef}
            className="w-full bg-surface-3 text-white text-xxs px-1.5 py-0.5 rounded-md outline-none border border-accent/50 focus:border-accent mt-1 transition-all"
            placeholder="e.g. npm run dev"
            value={serverCmd}
            onChange={(e) => setServerCmd(e.target.value)}
            onBlur={commitServerCommand}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitServerCommand();
              if (e.key === 'Escape') setEditingServer(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : editingGitUser ? (
          <div className="flex flex-col gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
            <input
              ref={gitNameRef}
              className="w-full bg-surface-3 text-white text-xxs px-1.5 py-0.5 rounded-md outline-none border border-accent/50 focus:border-accent transition-all"
              placeholder="user.name"
              value={gitName}
              onChange={(e) => setGitName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitGitUser();
                if (e.key === 'Escape') setEditingGitUser(false);
              }}
            />
            <input
              className="w-full bg-surface-3 text-white text-xxs px-1.5 py-0.5 rounded-md outline-none border border-accent/50 focus:border-accent transition-all"
              placeholder="user.email"
              value={gitEmail}
              onChange={(e) => setGitEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitGitUser();
                if (e.key === 'Escape') setEditingGitUser(false);
              }}
            />
            <div className="flex gap-1">
              <button
                className="text-xxs px-1.5 py-0.5 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
                onClick={commitGitUser}
              >Save</button>
              <button
                className="text-xxs px-1.5 py-0.5 rounded bg-surface-3 text-zinc-500 hover:text-white transition-colors"
                onClick={() => setEditingGitUser(false)}
              >Cancel</button>
            </div>
          </div>
        ) : (
          <div className="text-xxs text-zinc-600 truncate mt-0.5">{project.path}</div>
        )}
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0 mt-1">
        {busyCount > 0 && (
          <span className="flex items-center gap-1" title={`${busyCount} busy`}>
            <span className="text-xxs font-mono text-amber-500">{busyCount}</span>
            <div className="w-2.5 h-2.5 rounded-full border-[1.5px] border-amber-500/40 border-t-amber-500 animate-spin" />
          </span>
        )}
        {waitingCount > 0 && (
          <span className="flex items-center gap-1" title={`${waitingCount} waiting for input`}>
            <span className="text-xxs font-mono text-amber-400">{waitingCount}</span>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_4px_rgba(251,191,36,0.4)]" />
          </span>
        )}
        {terminalCount - busyCount - waitingCount > 0 && (
          <span className="flex items-center gap-1" title={`${terminalCount - busyCount - waitingCount} idle`}>
            <span className="text-xxs font-mono text-green-500">{terminalCount - busyCount - waitingCount}</span>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]" />
          </span>
        )}
        {projectTasks.length > 0 && (
          <span className="flex items-center gap-1" title={`${pendingTasks} pending, ${doneTasks} done`}>
            <span className="text-xxs font-mono text-zinc-500">{doneTasks}/{projectTasks.length}</span>
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none" className={pendingTasks > 0 ? 'text-amber-500' : 'text-green-500'}>
              <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 6h8M4 9h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </span>
        )}
      </div>
      {project.serverCommand && !editingServer && !editingGitUser && (
        <div className="w-full flex flex-wrap gap-1 mt-1 pt-1 border-t border-white/5">
          {serverTerminals.length === 0 && (
            <button
              className="flex items-center gap-1 text-xxs px-2 py-0.5 rounded-md font-medium transition-all duration-200 bg-surface-3 text-zinc-500 hover:text-white hover:bg-surface-4"
              onClick={(e) => {
                e.stopPropagation();
                handleServerClick();
              }}
              title="Start server"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="shrink-0"><rect x="1" y="4" width="14" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="10" width="14" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/></svg>
              Start
            </button>
          )}
          {serverTerminals.map((st) => (
            <div key={st.id} className="flex items-center gap-1">
              <button
                className="flex items-center gap-1 text-xxs px-2 py-0.5 rounded-md font-medium transition-all duration-200 bg-green-500/15 text-green-400 hover:bg-green-500/25 shadow-[0_0_8px_rgba(34,197,94,0.1)]"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleServer();
                }}
                title="View server terminal"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="shrink-0"><rect x="1" y="4" width="14" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="10" width="14" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/></svg>
                <span className="truncate">{st.name}</span>
              </button>
              <button
                className="text-xxs px-1 py-0.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTerminal(project.id, st.id);
                }}
                title="Stop server"
              >
                ■
              </button>
            </div>
          ))}
        </div>
      )}

      {showMenu && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] bg-surface-2 border border-border-hover rounded-lg shadow-panel py-1.5 animate-fade-in"
          style={{ left: menuPos.x, top: menuPos.y, width: 'max-content' }}
        >
          <button
            className="block w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-surface-3 hover:text-white transition-colors whitespace-nowrap"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
              setEditName(project.name);
              setEditing(true);
            }}
          >
            Rename
          </button>
          <button
            className="block w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-surface-3 hover:text-white transition-colors whitespace-nowrap"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
              setServerCmd(project.serverCommand || '');
              setEditingServer(true);
            }}
          >
            Configure Server
          </button>
          <button
            className="block w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-surface-3 hover:text-white transition-colors whitespace-nowrap"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
              setLogo(project.id);
            }}
          >
            Set Logo
          </button>
          {project.logo && (
            <button
              className="block w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-surface-3 hover:text-white transition-colors whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                clearLogo(project.id);
              }}
            >
              Remove Logo
            </button>
          )}
          <button
            className="block w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-surface-3 hover:text-white transition-colors whitespace-nowrap"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
              openGitUserEdit();
            }}
          >
            Git User
          </button>
          <div className="border-t border-border my-1.5 mx-2" />
          <button
            className="block w-full text-left px-3 py-1.5 text-xs text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors whitespace-nowrap"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
              onRemove();
            }}
          >
            Remove
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
