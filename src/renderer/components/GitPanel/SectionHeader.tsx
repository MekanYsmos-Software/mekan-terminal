import { useGitStore } from '../../stores/git';

interface Props {
  section: string;
  icon: React.ReactNode;
  label: string;
  count: number;
  action?: React.ReactNode;
}

export default function SectionHeader({ section, icon, label, count, action }: Props) {
  const collapsed = useGitStore((s) => s.collapsed[section]);
  const toggleSection = useGitStore((s) => s.toggleSection);

  return (
    <div className="flex items-center px-4 py-2 border-b border-border cursor-pointer select-none group" onClick={() => toggleSection(section)}>
      <svg
        width="10" height="10" viewBox="0 0 10 10" fill="none"
        className={`text-zinc-700 mr-1.5 transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`}
      >
        <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="text-zinc-600 mr-2 flex-shrink-0">{icon}</span>
      <span className="text-xxs font-semibold text-zinc-500 tracking-wider uppercase">{label}</span>
      <span className="text-xxs text-zinc-700 font-mono ml-1.5">{count}</span>
      <div className="flex-1" />
      {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
    </div>
  );
}
