import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Brain, Check, ChevronDown } from 'lucide-react';
import type { ProviderInfo, ReasoningEffort } from '@/types';

const LABELS: Record<ReasoningEffort, string> = {
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'X-High',
  max: 'Max',
  none: 'Off',
  adaptive: 'Adaptive',
};

const BLURBS: Partial<Record<ReasoningEffort, string>> = {
  minimal: 'Shortest reasoning pass',
  low: 'Fastest useful depth',
  medium: 'Balanced',
  high: 'Deeper reasoning',
  xhigh: 'Very deep',
  max: 'Maximum depth',
  none: 'Reasoning disabled',
  adaptive: 'Model decides',
};

interface ReasoningSelectorProps {
  provider: string;
  value: ReasoningEffort | null;
  onChange: (v: ReasoningEffort) => void;
}

/**
 * Reasoning-depth picker. Renders nothing for models that expose no graded
 * scale — the level list comes from the backend, which only advertises levels
 * the model's API was verified to accept.
 */
export function ReasoningSelector({ provider, value, onChange }: ReasoningSelectorProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });

  // Latest onChange, so the snap-to-default effect never reads a stale closure.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    fetch(`${API_URL}/api/providers`)
      .then(r => r.json())
      .then(data => setProviders(data.providers || []))
      .catch(() => setProviders([]));
  }, []);

  const info = providers.find(p => p.id === provider);
  const levels = info?.reasoningEfforts;

  // Snap to the model's default (its highest level) whenever the current pick
  // isn't valid for the newly selected model.
  useEffect(() => {
    if (!levels || levels.length === 0) return;
    if (value && levels.includes(value)) return;
    onChangeRef.current(info?.defaultReasoningEffort ?? levels[levels.length - 1]);
  }, [levels, value, info]);

  const close = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      setOpen(false);
    }, 130);
  };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 220;
      const spaceRight = window.innerWidth - rect.right;
      const spaceLeft = rect.left;
      const pos: { top: number; left?: number; right?: number } = { top: rect.top - 8 };
      if (spaceRight >= dropdownWidth + 16) {
        pos.left = rect.left;
      } else if (spaceLeft >= dropdownWidth + 16) {
        pos.right = window.innerWidth - rect.right;
      } else {
        pos.left = Math.max(8, rect.right - dropdownWidth);
      }
      setDropdownPos(pos);
    }
  }, [open]);

  // No graded scale for this model — show nothing rather than dead UI.
  if (!levels || levels.length === 0) return null;

  const current = value && levels.includes(value) ? value : levels[levels.length - 1];

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`Reasoning depth: ${LABELS[current]}`}
        className={cn(
          'flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[11.5px] font-medium transition-colors duration-150',
          open ? 'bg-white/[0.06] text-white' : 'text-adam-text-tertiary hover:bg-white/[0.05] hover:text-adam-text-secondary',
        )}
      >
        <Brain className="h-3.5 w-3.5" />
        {LABELS[current]}
        <ChevronDown className={cn('h-3 w-3 opacity-70 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {(open || closing) && createPortal(
        <div
          className="fixed z-[9999]"
          style={{
            top: dropdownPos.top + 'px',
            transform: 'translateY(-100%)',
            ...(dropdownPos.left !== undefined ? { left: dropdownPos.left + 'px' } : {}),
            ...(dropdownPos.right !== undefined ? { right: dropdownPos.right + 'px' } : {}),
          }}
        >
          <div
            role="listbox"
            className={cn(
              'w-[220px] overflow-y-auto rounded-xl border border-white/[0.06] bg-[#1E1F20] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.55)]',
              closing ? 'animate-menu-out' : 'animate-menu-in',
            )}
            style={{ transformOrigin: 'bottom left' }}
            onMouseDown={e => e.stopPropagation()}
          >
            {levels.map(level => {
              const selected = level === current;
              return (
                <button
                  key={level}
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(level);
                    close();
                  }}
                  className={cn(
                    'relative z-10 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-100 hover:bg-white/[0.04]',
                    selected && 'bg-white/[0.06]',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[13px]', selected ? 'font-medium text-white' : 'text-adam-text-secondary')}>
                      {LABELS[level]}
                    </span>
                    {BLURBS[level] && (
                      <span className="block truncate text-[10.5px] text-adam-text-tertiary">{BLURBS[level]}</span>
                    )}
                  </span>
                  {selected && (
                    <span className="shrink-0 text-adam-blue">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
