import { useState, useRef, useEffect } from 'react';
import { API_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Eye, Zap, Brain, Cpu, X } from 'lucide-react';

interface ProviderInfo {
  id: string;
  name: string;
  model: string;
  hasKey: boolean;
  supportsVision: boolean;
  maxContextTokens?: number;
}

interface ProviderSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
  requireVision?: boolean;
}

export function ProviderSelector({ selected, onSelect, requireVision = false }: ProviderSelectorProps) {
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/providers`)
      .then(r => r.json())
      .then(data => {
        let list = (data.providers || []).filter((p: ProviderInfo) => p.hasKey);
        if (requireVision) {
          list = list.filter((p: ProviderInfo) => p.supportsVision);
        }
        setProviders(list);
        
        // Auto-switch to first vision provider if current doesn't support vision
        if (requireVision && list.length > 0) {
          const currentProvider = list.find((p: ProviderInfo) => p.id === selected);
          if (!currentProvider?.supportsVision) {
            onSelect(list[0].id);
          }
        }
      })
      .catch(() => setProviders([]))
      .finally(() => setLoading(false));
  }, [requireVision, selected, onSelect]);

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

  if (loading) {
    return (
      <span className="text-[11px] text-adam-text-tertiary">Loading…</span>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] transition-all',
          open
            ? 'bg-adam-blue/20 text-adam-blue'
            : 'bg-adam-neutral-800 text-adam-text-tertiary hover:bg-adam-neutral-700 hover:text-adam-text-secondary'
        )}
      >
        <span className="font-medium">{selectedProvider?.name?.split(' (')[0] || 'Model'}</span>
        {selectedProvider?.supportsVision && <Eye className="w-3 h-3 text-adam-blue/70" />}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-72 max-h-72 overflow-y-auto rounded-2xl border border-adam-neutral-700 bg-adam-background-2 p-1.5 shadow-lg z-50">
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); setOpen(false); }}
              className={cn(
                'flex flex-col w-full items-start rounded-xl px-3 py-2 text-left transition-colors hover:bg-adam-neutral-800',
                selected === p.id && 'bg-adam-neutral-800/60'
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-sm text-adam-text-primary font-medium">{p.name}</span>
                <div className="flex items-center gap-1">
                  {p.supportsVision && (
                    <span className="flex items-center gap-0.5 text-[10px] text-adam-blue/70">
                      <Eye className="w-3 h-3" /> Vision
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-adam-text-tertiary/60 font-mono">{p.model}</span>
                {p.maxContextTokens && (
                  <span className="text-[10px] text-adam-text-tertiary/40">
                    {p.maxContextTokens >= 1000 ? `${(p.maxContextTokens/1000).toFixed(0)}K` : p.maxContextTokens} ctx
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
