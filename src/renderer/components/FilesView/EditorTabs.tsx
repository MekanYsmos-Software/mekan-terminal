import { useFilesStore } from '../../stores/files';

export default function EditorTabs() {
  const openTabs = useFilesStore((s) => s.openTabs);
  const activeTabPath = useFilesStore((s) => s.activeTabPath);
  const setActiveTab = useFilesStore((s) => s.setActiveTab);
  const closeTab = useFilesStore((s) => s.closeTab);

  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center h-8 bg-surface-1 border-b border-border overflow-x-auto flex-shrink-0">
      {openTabs.map((tab) => (
        <div
          key={tab.filePath}
          className={`group flex items-center gap-1.5 px-3 h-full text-xxs cursor-pointer border-r border-border transition-colors ${
            tab.filePath === activeTabPath
              ? 'bg-surface-0 text-white'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-2'
          }`}
          onClick={() => setActiveTab(tab.filePath)}
        >
          <span className="truncate max-w-[120px]">{tab.name}</span>
          {tab.dirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
          )}
          <button
            className="ml-1 w-4 h-4 flex items-center justify-center rounded-sm text-zinc-600 hover:text-white hover:bg-surface-3 transition-colors opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.filePath);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
