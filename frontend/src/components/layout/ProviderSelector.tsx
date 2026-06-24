import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Eye, ChevronDown, Shield, Cloud } from 'lucide-react';

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

function getProviderDescription(providerId: string, providerName: string): string {
  const id = providerId.toLowerCase();
  const name = providerName.toLowerCase();
  if (id.includes('gemini') || name.includes('gemini') || id.includes('google')) {
    return 'Latest Google model with excellent multi-modal capabilities';
  }
  if (id.includes('claude') || name.includes('claude') || id.includes('anthropic')) {
    return 'Most powerful Anthropic model for complex reasoning';
  }
  if (id.includes('gpt') || name.includes('gpt') || id.includes('openai')) {
    return 'Latest OpenAI model for reliable CAD generation';
  }
  if (id.includes('glm') || name.includes('glm')) {
    return 'Z.AI model with strong agentic coding and reasoning';
  }
  if (id === '0g') {
    return 'TEE-verified model running in a decentralized trusted execution environment';
  }
  if (id.includes('0g-deepseek') || (id.includes('0g') && id.includes('deepseek'))) {
    return 'DeepSeek V4 running in 0G TEE — fast reasoning with verifiable compute';
  }
  if (id.includes('mimo')) {
    return 'MiMo core model with high-context reasoning';
  }
  if (id.includes('deepseek') && !id.includes('0g')) {
    return 'Most powerful reasoning model for complex CAD operations';
  }
  if (id.includes('qwen')) {
    return 'Qwen model with excellent multi-lingual and vision capabilities';
  }
  if (id.includes('groq') || id.includes('llama')) {
    return 'Groq Llama model optimized for ultra-fast generation';
  }
  return 'Advanced AI model optimized for CAD generation';
}

export function ProviderSelector({ selected, onSelect, requireVision = false }: ProviderSelectorProps) {
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });

  // Keep a ref to the latest selected value so async callbacks never read a stale closure.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // ── DEBUG: Log every render ──
  console.log('[ProviderSelector] render', {
    selected,
    providersCount: providers.length,
    loading,
    providerIds: providers.map(p => p.id),
    selectedProvider: providers.find(p => p.id === selected)?.name ?? 'NOT FOUND',
  });

  // ── Fetch providers once on mount, re-fetch when vision requirement changes ──
  useEffect(() => {
    console.log('[ProviderSelector] fetch effect firing');
    fetch(`${API_URL}/api/providers`)
      .then(r => r.json())
      .then(data => {
        const all = (data.providers || []).filter((p: ProviderInfo) => p.hasKey);
        console.log('[ProviderSelector] fetch resolved', { count: all.length, ids: all.map((p: ProviderInfo) => p.id) });
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
      console.log('[ProviderSelector] auto-switch: current selection is valid, no change', { selected: selectedRef.current });
      return;
    }

    // Otherwise fall back to the first valid provider
    console.log('[ProviderSelector] auto-switch: switching to first valid provider', { from: selectedRef.current, to: valid[0]?.id });
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
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 290;
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

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
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

      {open && createPortal(
        <div
          className="fixed w-[290px] max-h-[320px] overflow-y-auto rounded-2xl border border-[#2d2e2f]/90 bg-[#1e1e1f] p-1.5 shadow-2xl z-[9999] chat-scroll"
          onMouseDown={e => e.stopPropagation()}
          style={{
            top: dropdownPos.top + 'px',
            transform: 'translateY(-100%)',
            ...(dropdownPos.left !== undefined ? { left: dropdownPos.left + 'px' } : {}),
            ...(dropdownPos.right !== undefined ? { right: dropdownPos.right + 'px' } : {}),
          }}
        >
          {/* Decentralized TEE Verified Models */}
          {visibleProviders.filter(p => p.isZeroG).length > 0 && (
            <>
              <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5">
                <Shield className="w-3 h-3 text-emerald-400/80" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80">
                  Decentralized TEE Verified
                </span>
              </div>
              {visibleProviders.filter(p => p.isZeroG).map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex flex-col w-full items-start rounded-xl px-4 py-3 text-left transition-colors duration-150 outline-none',
                    selected === p.id
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'hover:bg-[#2c2d2e]/80'
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[13px] text-white font-semibold">{p.name}</span>
                    <div className="flex items-center gap-1.5">
                      {p.supportsVision && (
                        <span className="flex items-center gap-0.5 text-[10px] text-blue-400/80 font-medium">
                          <Eye className="w-3 h-3" /> Vision
                        </span>
                      )}
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-400/60 font-medium">
                        <Shield className="w-2.5 h-2.5" /> TEE
                      </span>
                    </div>
                  </div>
                  <p className="text-[11.5px] text-[#9ca3af] mt-0.5 leading-relaxed font-normal">
                    {getProviderDescription(p.id, p.name)}
                  </p>
                  {p.maxContextTokens && (
                    <div className="text-[9px] text-[#9ca3af]/40 mt-1 font-mono">
                      {p.maxContextTokens >= 1000 ? `${(p.maxContextTokens/1000).toFixed(0)}K` : p.maxContextTokens} ctx
                    </div>
                  )}
                </button>
              ))}
              <div className="h-px bg-[#2d2e2f] mx-3 my-1.5" />
            </>
          )}

          {/* Centralized AI Providers */}
          {visibleProviders.filter(p => !p.isZeroG).length > 0 && (
            <>
              <div className="flex items-center gap-1.5 px-3 pt-1 pb-1.5">
                <Cloud className="w-3 h-3 text-[#9ca3af]/60" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]/60">
                  Centralized AI Providers
                </span>
              </div>
              {visibleProviders.filter(p => !p.isZeroG).map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex flex-col w-full items-start rounded-xl px-4 py-3 text-left transition-colors duration-150 outline-none',
                    selected === p.id
                      ? 'bg-[#292a2b]'
                      : 'hover:bg-[#2c2d2e]/80'
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[13px] text-white font-semibold">{p.name}</span>
                    <div className="flex items-center gap-1">
                      {p.supportsVision && (
                        <span className="flex items-center gap-0.5 text-[10px] text-blue-400/80 font-medium">
                          <Eye className="w-3 h-3" /> Vision
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[11.5px] text-[#9ca3af] mt-0.5 leading-relaxed font-normal">
                    {getProviderDescription(p.id, p.name)}
                  </p>
                  {p.maxContextTokens && (
                    <div className="text-[9px] text-[#9ca3af]/40 mt-1 font-mono">
                      {p.maxContextTokens >= 1000 ? `${(p.maxContextTokens/1000).toFixed(0)}K` : p.maxContextTokens} ctx
                    </div>
                  )}
                </button>
              ))}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

