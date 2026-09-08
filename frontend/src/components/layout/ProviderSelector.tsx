import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Eye, ChevronDown, Shield, Check } from 'lucide-react';

interface ProviderInfo {
  id: string;
  name: string;
  model: string;
  hasKey: boolean;
  supportsVision: boolean;
  maxContextTokens?: number;
  isZeroG?: boolean;
}

interface ProviderSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
  requireVision?: boolean;
}

function formatContext(tokens?: number): string {
  if (!tokens) return '';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 ? 1 : 0)}M ctx`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K ctx`;
  return `${tokens} ctx`;
}

/** One concise row: name · context · vision · tee · selected check. */
function ProviderRow({
  name,
  supportsVision,
  isZeroG,
  maxContextTokens,
  selected,
  onSelect,
}: {
  name: string;
  supportsVision: boolean;
  isZeroG?: boolean;
  maxContextTokens?: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative z-10 flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left transition-colors duration-100 hover:bg-white/[0.04]',
        selected && 'bg-white/[0.06]',
      )}
    >
      <span className={cn('min-w-0 flex-1 truncate text-[13px]', selected ? 'font-medium text-white' : 'text-adam-text-secondary')}>
        {name}
      </span>
      {maxContextTokens && (
        <span className="shrink-0 text-[11px] tabular-nums text-adam-text-secondary">
          {formatContext(maxContextTokens)}
        </span>
      )}
      {supportsVision && (
        <span className="shrink-0 text-adam-text-tertiary" title="Supports vision input">
          <Eye className="h-3.5 w-3.5" />
        </span>
      )}
      {isZeroG && (
        <span className="shrink-0 text-emerald-400/70" title="TEE-verified on 0G">
          <Shield className="h-3 w-3" />
        </span>
      )}
      {selected && (
        <span className="shrink-0 text-adam-blue">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}

function GroupHeader({ label, tee }: { label: string; tee?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 px-2 pb-1 pt-1.5">
      {tee && <Shield className="h-2.5 w-2.5 text-emerald-400/60" />}
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-adam-text-tertiary">
        {label}
      </span>
    </div>
  );
}

export function ProviderSelector({ selected, onSelect, requireVision = false }: ProviderSelectorProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });

  // Play the exit animation, then unmount
  const close = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      setOpen(false);
    }, 130);
  };

  // Keep a ref to the latest selected value so async callbacks never read a stale closure.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // ── Fetch providers once on mount ──
  useEffect(() => {
    fetch(`${API_URL}/api/providers`)
      .then(r => r.json())
      .then(data => {
        const all = (data.providers || []).filter((p: ProviderInfo) => p.hasKey);
        setProviders(all);
      })
      .catch((err) => {
        console.error('[ProviderSelector] fetch failed', err);
        setProviders([]);
      })
      .finally(() => setLoading(false));
  }, []); // Only fetch once — the providers list doesn't change based on selection

  // ── Auto-switch: only when the selected provider is genuinely unavailable ──
  useEffect(() => {
    if (providers.length === 0) return;

    // Build the list of valid providers for the current vision requirement
    const valid = requireVision
      ? providers.filter(p => p.supportsVision)
      : providers;

    // If the current selection is already valid, do nothing
    if (valid.some(p => p.id === selectedRef.current)) {
      return;
    }

    // Otherwise fall back to the first valid provider
    if (valid.length > 0) {
      onSelect(valid[0].id);
    }
  }, [providers, requireVision, onSelect]);

  // The list actually shown in the dropdown — filtered by vision if needed
  const visibleProviders = requireVision
    ? providers.filter(p => p.supportsVision)
    : providers;

  const selectedProvider = providers.find(p => p.id === selected);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 260;
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

  if (loading) {
    return (
      <span className="text-[11px] text-adam-text-tertiary">Loading…</span>
    );
  }

  const teeProviders = visibleProviders.filter(p => p.isZeroG);
  const centralProviders = visibleProviders.filter(p => !p.isZeroG);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          'h-8 flex items-center gap-1.5 bg-transparent text-xs transition-all font-normal shrink-0 outline-none',
          open
            ? 'text-white'
            : 'text-neutral-400 hover:text-white'
        )}
      >
        <span>{selectedProvider?.name?.split(' (')[0] || 'Model'}</span>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 transition-transform duration-200 opacity-70",
          open && "rotate-180"
        )} />
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
            className={cn(
              'w-[260px] max-h-[320px] overflow-y-auto rounded-xl border border-white/[0.06] bg-[#1E1F20] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.55)] chat-scroll',
              closing ? 'animate-menu-out' : 'animate-menu-in',
            )}
            style={{ transformOrigin: 'bottom left' }}
            onMouseDown={e => e.stopPropagation()}
          >
          {teeProviders.length > 0 && (
            <>
              <GroupHeader label="Decentralized TEE" tee />
              {teeProviders.map(p => (
                <ProviderRow
                  key={p.id}
                  name={p.name}
                  supportsVision={p.supportsVision}
                  isZeroG
                  maxContextTokens={p.maxContextTokens}
                  selected={selected === p.id}
                  onSelect={() => {
                    onSelect(p.id);
                    close();
                  }}
                />
              ))}
            </>
          )}

          {teeProviders.length > 0 && centralProviders.length > 0 && (
            <div className="mx-2 my-1 h-px bg-white/[0.05]" />
          )}

          {centralProviders.length > 0 && (
            <>
              <GroupHeader label="Centralized Providers" />
              {centralProviders.map(p => (
                <ProviderRow
                  key={p.id}
                  name={p.name}
                  supportsVision={p.supportsVision}
                  maxContextTokens={p.maxContextTokens}
                  selected={selected === p.id}
                  onSelect={() => {
                    onSelect(p.id);
                    close();
                  }}
                />
              ))}
            </>
          )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
