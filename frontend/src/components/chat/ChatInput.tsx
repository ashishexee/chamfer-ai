import { ArrowUp, Brain } from 'lucide-react';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';
import { ProviderSelector } from '@/components/layout/ProviderSelector';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  prompt: string;
  setPrompt: (v: string) => void;
  onSubmit: () => void;
  isGenerating: boolean;
  isFocused: boolean;
  setIsFocused: (v: boolean) => void;
  provider: string;
  setProvider: (v: string) => void;
  placeholder: string;
  reasoningEnabled: boolean;
  setReasoningEnabled: (v: boolean) => void;
  showAnimatedPlaceholder?: boolean;
}

export function ChatInput({
  prompt, setPrompt, onSubmit, isGenerating, isFocused, setIsFocused,
  provider, setProvider, placeholder, reasoningEnabled, setReasoningEnabled,
  showAnimatedPlaceholder,
}: ChatInputProps) {
  return (
    <div className={cn(
      'relative rounded-2xl border transition-all duration-300 bg-adam-background-2/80 backdrop-blur-sm',
      isFocused
        ? 'border-adam-blue/60 shadow-[0_0_0_3px_rgba(0,166,255,0.08),inset_0_1px_0_rgba(255,255,255,0.03)]'
        : 'border-adam-neutral-700/50 hover:border-adam-neutral-600/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]'
    )}>
      {showAnimatedPlaceholder && !prompt && !isFocused && (
        <AnimatedPlaceholder visible />
      )}
      <textarea
        className="w-full bg-transparent px-4 pt-3.5 pb-2 text-sm text-adam-text-primary resize-none outline-none placeholder:text-adam-text-tertiary/60"
        rows={3}
        placeholder={showAnimatedPlaceholder ? '' : placeholder}
        value={prompt}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
      />
      <div className="flex items-center justify-between px-3 pb-2.5">
        <div className="flex items-center gap-2 flex-1 max-w-[300px]">
          <ProviderSelector selected={provider} onSelect={setProvider} />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setReasoningEnabled(!reasoningEnabled)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all',
              reasoningEnabled
                ? 'bg-adam-blue/15 text-adam-blue ring-1 ring-adam-blue/15'
                : 'bg-adam-neutral-800/60 text-adam-text-tertiary hover:bg-adam-neutral-700/60 hover:text-adam-text-secondary'
            )}
            title={reasoningEnabled ? 'Reasoning mode — slower, more thorough' : 'Fast mode — quicker responses'}
          >
            <Brain className="h-3 w-3" />
            {reasoningEnabled ? 'Think' : 'Fast'}
          </button>
          <button
            onClick={() => onSubmit()}
            disabled={isGenerating || !prompt.trim()}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
              prompt.trim() && !isGenerating
                ? 'bg-adam-blue text-white hover:bg-adam-blue/90 shadow-[0_2px_8px_rgba(0,166,255,0.25)]'
                : 'bg-adam-neutral-800/60 text-adam-text-tertiary cursor-not-allowed'
            )}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
