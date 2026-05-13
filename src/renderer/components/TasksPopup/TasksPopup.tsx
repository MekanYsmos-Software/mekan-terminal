import { useState, useRef, useEffect } from 'react';
import { useTasksStore } from '../../stores/tasks';
import type { TaskStatus, ProjectTask } from '@shared/types';

const EMPTY_TASKS: ProjectTask[] = [];

interface Props {
  projectId: string;
  open: boolean;
  onClose(): void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  ongoing: 'Ongoing',
  done: 'Done',
};

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'ongoing',
  ongoing: 'done',
  done: 'todo',
};

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function isOverdue(dueDate: string | null, status: TaskStatus) {
  if (!dueDate || status === 'done') return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function isDueSoon(dueDate: string | null, status: TaskStatus) {
  if (!dueDate || status === 'done') return false;
  const due = new Date(dueDate);
  const today = new Date(new Date().toDateString());
  const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 2;
}

export default function TasksPopup({ projectId, open, onClose, anchorRef }: Props) {
  const tasks = useTasksStore((s) => s.tasks[projectId] ?? EMPTY_TASKS);
  const addTask = useTasksStore((s) => s.addTask);
  const updateStatus = useTasksStore((s) => s.updateStatus);
  const updateDueDate = useTasksStore((s) => s.updateDueDate);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const loadTasks = useTasksStore((s) => s.loadTasks);
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState('');
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) loadTasks(projectId);
  }, [open, projectId, loadTasks]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    addTask(projectId, title, newDue || null);
    setNewTitle('');
    setNewDue('');
  }

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);
  const sorted = [...filtered].sort((a, b) => {
    const order: Record<TaskStatus, number> = { ongoing: 0, todo: 1, done: 2 };
    return order[a.status] - order[b.status];
  });

  const counts = {
    todo: tasks.filter((t) => t.status === 'todo').length,
    ongoing: tasks.filter((t) => t.status === 'ongoing').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };

  return (
    <div
      ref={popupRef}
      className="absolute top-full left-0 mt-1.5 z-50 bg-surface-2 border border-border-hover rounded-lg shadow-panel animate-fade-in"
      style={{ width: 400 }}
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-xs font-semibold text-zinc-300">Tasks</span>
          <div className="flex-1" />
          <div className="flex gap-0.5 text-xxs bg-surface-3 rounded-md p-0.5">
            {(['all', 'todo', 'ongoing', 'done'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  filter === f ? 'bg-surface-2 text-zinc-200 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {f === 'all' ? `All (${tasks.length})` : `${STATUS_LABELS[f]} (${counts[f]})`}
              </button>
            ))}
          </div>
        </div>

        {/* Add task */}
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            className="flex-1 bg-surface-3 text-white text-xs px-2.5 py-2 rounded-md outline-none border border-border focus:border-accent/50 transition-all placeholder:text-zinc-600"
            placeholder="New task..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <DatePicker value={newDue} onChange={setNewDue} />
          <button
            onClick={handleAdd}
            className="text-xs px-3 py-2 rounded-md bg-accent text-white hover:bg-accent-hover transition-all font-medium shrink-0"
          >
            Add
          </button>
        </div>
      </div>

      {/* Task list */}
      <div className="max-h-72 overflow-y-auto px-1.5 pb-2">
        {sorted.length === 0 && (
          <div className="text-xxs text-zinc-700 text-center py-6">No tasks</div>
        )}
        {sorted.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onCycleStatus={() => updateStatus(projectId, task.id, NEXT_STATUS[task.status])}
            onUpdateDue={(d) => updateDueDate(projectId, task.id, d)}
            onDelete={() => deleteTask(projectId, task.id)}
          />
        ))}
      </div>
    </div>
  );
}

function DatePicker({ value, onChange }: { value: string; onChange(v: string): void }) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <button
      type="button"
      onClick={() => ref.current?.showPicker()}
      className={`relative flex items-center gap-1 text-xxs px-2 py-2 rounded-md border transition-all shrink-0 ${
        value
          ? 'bg-accent/10 border-accent/30 text-accent hover:bg-accent/15'
          : 'bg-surface-3 border-border text-zinc-500 hover:text-zinc-400 hover:border-zinc-600'
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0">
        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <span>{value ? formatDate(value) : 'Date'}</span>
      {value && (
        <span
          onClick={(e) => { e.stopPropagation(); onChange(''); }}
          className="ml-0.5 hover:text-red-400 cursor-pointer"
        >
          ×
        </span>
      )}
      <input
        ref={ref}
        type="date"
        className="absolute inset-0 opacity-0 cursor-pointer"
        style={{ width: '100%', height: '100%' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
      />
    </button>
  );
}

function TaskRow({
  task,
  onCycleStatus,
  onUpdateDue,
  onDelete,
}: {
  task: ProjectTask;
  onCycleStatus(): void;
  onUpdateDue(d: string | null): void;
  onDelete(): void;
}) {
  const overdue = isOverdue(task.dueDate, task.status);
  const soon = isDueSoon(task.dueDate, task.status);

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-3 group transition-colors">
      <button
        onClick={onCycleStatus}
        className={`w-3.5 h-3.5 rounded-full flex-shrink-0 border-2 transition-all ${
          task.status === 'done'
            ? 'bg-green-500 border-green-500'
            : task.status === 'ongoing'
            ? 'bg-amber-500 border-amber-500'
            : 'border-zinc-600 hover:border-zinc-400'
        }`}
        title={`${STATUS_LABELS[task.status]} → ${STATUS_LABELS[NEXT_STATUS[task.status]]}`}
      />
      <div className="flex-1 min-w-0">
        <div className={`text-xs truncate ${task.status === 'done' ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>
          {task.title}
        </div>
      </div>
      <TaskDateBadge
        dueDate={task.dueDate}
        overdue={overdue}
        soon={soon}
        done={task.status === 'done'}
        onChange={onUpdateDue}
      />
      <button
        onClick={onDelete}
        className="w-4 h-4 flex items-center justify-center rounded text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
      >
        <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}

function TaskDateBadge({
  dueDate,
  overdue,
  soon,
  done,
  onChange,
}: {
  dueDate: string | null;
  overdue: boolean;
  soon: boolean;
  done: boolean;
  onChange(d: string | null): void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  if (!dueDate) {
    return (
      <button
        onClick={() => ref.current?.showPicker()}
        className="relative w-5 h-5 flex items-center justify-center rounded text-zinc-700 opacity-0 group-hover:opacity-100 hover:text-zinc-400 transition-all"
        title="Set due date"
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.3" />
          <path d="M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <input
          ref={ref}
          type="date"
          className="absolute inset-0 opacity-0 cursor-pointer"
          style={{ width: '100%', height: '100%' }}
          value=""
          onChange={(e) => onChange(e.target.value || null)}
          tabIndex={-1}
        />
      </button>
    );
  }

  const colors = done
    ? 'bg-zinc-800 text-zinc-600'
    : overdue
    ? 'bg-red-500/15 text-red-400'
    : soon
    ? 'bg-amber-500/15 text-amber-400'
    : 'bg-zinc-800 text-zinc-500';

  return (
    <button
      onClick={() => ref.current?.showPicker()}
      className={`relative flex items-center gap-1 text-xxs px-1.5 py-0.5 rounded-md transition-all hover:brightness-125 ${colors}`}
      title="Change due date"
    >
      <svg width="9" height="9" viewBox="0 0 16 16" fill="none" className="shrink-0">
        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {formatDate(dueDate)}
      <input
        ref={ref}
        type="date"
        className="absolute inset-0 opacity-0 cursor-pointer"
        style={{ width: '100%', height: '100%' }}
        value={dueDate}
        onChange={(e) => onChange(e.target.value || null)}
        tabIndex={-1}
      />
    </button>
  );
}
