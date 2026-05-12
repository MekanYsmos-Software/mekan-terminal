export default function App() {
  return (
    <div className="flex h-screen w-screen bg-surface-0 text-zinc-200">
      <div className="w-60 bg-surface-1 border-r border-zinc-800 p-2">
        Sidebar
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 bg-surface-0 p-2">Terminal Grid</div>
        <div className="h-8 bg-surface-2 border-t border-zinc-800 px-3 flex items-center text-xs text-zinc-400">
          Status Bar
        </div>
      </div>
    </div>
  );
}
