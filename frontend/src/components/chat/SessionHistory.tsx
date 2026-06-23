import type { SessionListItem } from '@/types';

interface SessionHistoryProps {
  sessions: SessionListItem[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  compact?: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function SessionHistory({ sessions, activeSessionId, onSelect, compact }: SessionHistoryProps) {
  if (sessions.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {!compact && (
        <div className="px-3 py-2 text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-[0.1em]">
          Chat History
        </div>
      )}
      {sessions.slice(0, compact ? 5 : 20).map(s => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors truncate ${
            activeSessionId === s.id
              ? 'bg-adam-blue/15 text-adam-blue font-medium'
              : 'text-adam-text-secondary hover:bg-white/[0.03] hover:text-adam-text-primary'
          }`}
        >
          <div className="truncate">{s.title}</div>
          <div className="text-[9px] text-adam-text-tertiary mt-0.5">{timeAgo(s.updated_at || s.created_at)}</div>
        </button>
      ))}
    </div>
  );
}
