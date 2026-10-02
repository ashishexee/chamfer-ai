import { ArrowUp, ImagePlus, Maximize2, Minimize2, X } from 'lucide-react';
import { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';
import { ProviderSelector } from '@/components/layout/ProviderSelector';
import { ReasoningSelector } from './ReasoningSelector';
import { fileToBase64, validateImage, compressImage } from '@/lib/imageUtils';
import { cn } from '@/lib/utils';
import type { ReasoningEffort } from '@/types';

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
  reasoningEffort: ReasoningEffort | null;
  setReasoningEffort: (v: ReasoningEffort) => void;
  showAnimatedPlaceholder?: boolean;
  images: string[];
  onImagesChange: (images: string[]) => void;
  providerSupportsVision: boolean;
  isConnected?: boolean;
  /** Landing-page hero sizing — taller rest height, larger text. */
  hero?: boolean;
}

/**
 * Composer in the Beautiful UI prompt-bar grammar: one rounded card,
 * a single auto-growing textarea, attachment chips above the input, and
 * ghost controls — without the @// menus, dictation, or shader sweep we
 * don't have backing features for.
 */
export function ChatInput({
  prompt, setPrompt, onSubmit, isGenerating, isFocused, setIsFocused,
  provider, setProvider, placeholder, reasoningEffort, setReasoningEffort,
  showAnimatedPlaceholder, images, onImagesChange,
  providerSupportsVision, isConnected = true, hero = false,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Auto-grow: compact at rest, expands with content, scrolls past the cap.
  // The expand toggle locks a taller working area.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const content = el.scrollHeight;
    const min = expanded ? 200 : hero ? 96 : 56;
    const max = expanded ? 320 : hero ? 220 : 140;
    el.style.height = `${Math.min(Math.max(content, min), max)}px`;
    el.style.overflowY = content > max ? 'auto' : 'hidden';
  }, [prompt, expanded, hero]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [...images];
    setImageError(null);

    for (const file of Array.from(files)) {
      const validation = validateImage(file);
      if (!validation.valid) {
        setImageError(validation.error ?? null);
        continue;
      }

      try {
        let dataUrl = await fileToBase64(file);
        // Compress if large (base64 ~4/3 of binary, so 8MB base64 ≈ 6MB binary)
        if (dataUrl.length > 8 * 1024 * 1024) {
          dataUrl = await compressImage(dataUrl, 1024);
        }
        newImages.push(dataUrl);
      } catch {
        setImageError('Failed to process image');
      }
    }

    onImagesChange(newImages);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [images, onImagesChange]);

  const removeImage = useCallback((index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  }, [images, onImagesChange]);

  const canSend = !!prompt.trim() || images.length > 0;

  return (
    <div
      className={cn(
        'relative flex flex-col gap-1.5 overflow-hidden rounded-[14px] border bg-adam-background-2/80 backdrop-blur-sm p-1.5 transition-colors duration-150',
        isFocused
          ? 'border-adam-blue/40'
          : 'border-white/[0.07] hover:border-white/[0.11]'
      )}
    >
      {showAnimatedPlaceholder && !prompt && !isFocused && (
        <AnimatedPlaceholder visible />
      )}

      {/* Reference image chips */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-0.5 pt-0.5">
          {images.map((img, i) => (
            <div
              key={i}
              className="relative shrink-0"
              style={{ animation: 'pop-in 200ms cubic-bezier(0.23,1,0.32,1) both' }}
            >
              <img
                src={img}
                alt={`Reference ${i + 1}`}
                className="h-12 w-12 rounded-lg object-cover ring-1 ring-white/[0.08]"
              />
              {/* Always visible — touch devices have no hover */}
              <button
                onClick={() => removeImage(i)}
                aria-label={`Remove reference image ${i + 1}`}
                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#2A2B2B] text-adam-text-tertiary ring-1 ring-white/[0.1] transition-colors hover:text-red-400"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        rows={1}
        className={cn(
          'w-full resize-none bg-transparent outline-none placeholder:text-adam-text-tertiary/60 [overflow-wrap:anywhere]',
          expanded
            ? 'min-h-[200px] px-1.5 py-[7px] text-[13px] leading-[18px]'
            : hero
              ? 'min-h-[96px] px-2 py-2.5 text-sm leading-5'
              : 'min-h-[56px] px-1.5 py-[7px] text-[13px] leading-[18px]',
          'text-adam-text-primary',
        )}
        placeholder={showAnimatedPlaceholder ? '' : placeholder}
        value={prompt}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
      />

      {imageError && (
        <div className="px-1.5 text-[11px] text-red-400/90">{imageError}</div>
      )}

      {/* Controls row */}
      <div className="flex items-center gap-2 px-0.5">
        {providerSupportsVision && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload reference images"
              className={cn(
                'flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[11.5px] font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.94]',
                images.length > 0
                  ? 'bg-adam-blue/15 text-adam-blue'
                  : 'text-adam-text-tertiary hover:bg-white/[0.05] hover:text-adam-text-secondary'
              )}
              title="Upload reference images"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse composer' : 'Expand composer'}
          aria-pressed={expanded}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-150 active:scale-[0.94]',
            expanded
              ? 'bg-adam-blue/15 text-adam-blue'
              : 'text-adam-text-tertiary hover:bg-white/[0.05] hover:text-adam-text-secondary',
          )}
          title={expanded ? 'Collapse composer' : 'Expand composer'}
        >
          {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <ProviderSelector selected={provider} onSelect={setProvider} requireVision={images.length > 0} />
          <ReasoningSelector provider={provider} value={reasoningEffort} onChange={setReasoningEffort} />
          <button
            onClick={() => onSubmit()}
            disabled={!isConnected || isGenerating || !canSend}
            aria-label="Send"
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-150 enabled:active:scale-[0.94]',
              canSend && !isGenerating && isConnected
                ? 'bg-adam-blue text-white hover:bg-adam-blue/90'
                : 'bg-white/[0.06] text-adam-text-tertiary cursor-not-allowed'
            )}
            title={!isConnected ? 'Please connect your wallet first' : ''}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
