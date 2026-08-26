import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { HelpCircle, Check } from 'lucide-react';

const PERKS: Array<{ title: string; body: string }> = [
  {
    title: 'Sealed execution',
    body: 'Your prompt and designs are processed inside the enclave \u2014 even the provider can\u2019t inspect them.',
  },
  {
    title: 'Signed & proven',
    body: 'Every response is cryptographically signed and verified against the provider\u2019s on-chain identity. No trust required.',
  },
  {
    title: 'Tamper-proof',
    body: 'Responses can\u2019t be altered in transit without breaking the proof.',
  },
  {
    title: 'Never used for training',
    body: 'Your data isn\u2019t exposed to shared infrastructure and doesn\u2019t train anyone\u2019s models.',
  },
  {
    title: 'Auditable anytime',
    body: 'Hit \u201CRe-verify\u201D or share the receipt \u2014 anyone can re-check the math.',
  },
];

const POPOVER_W = 320;
const MARGIN = 12;

/**
 * Small "?" beside the TEE badges. Hover or click opens a popover explaining what
 * TEE Verified actually guarantees — the transparency pitch, in plain language.
 *
 * Rendered through a portal with fixed positioning: the chat panel is a scroll
 * container, so an absolutely-positioned popover would be clipped by it.
 */
export function TeeVerifiedInfo() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ right: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const openNow = useCallback(() => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);

  const closeSoon = useCallback(() => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, []);

  // Anchor the popover to the button, flipping above when there is no room below.
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const maxHeight = Math.min(470, window.innerHeight - 2 * MARGIN);
    let right = window.innerWidth - rect.right;
    right = Math.max(MARGIN, Math.min(right, window.innerWidth - POPOVER_W - MARGIN));
    const fitsBelow = window.innerHeight - rect.bottom >= Math.min(maxHeight, 260) + MARGIN;
    setPos({
      right,
      top: fitsBelow ? rect.bottom + 8 : undefined,
      bottom: fitsBelow ? undefined : window.innerHeight - rect.top + 8,
      maxHeight,
    });
  }, [open]);

  // Dismiss on outside click, Escape, or any scroll (the anchor would drift).
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = (e: Event) => {
      // Scrolling inside the popover is fine — only close when the page/panel scrolls
      // (the anchor would drift).
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <button
        ref={btnRef}
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="inline-flex items-center justify-center h-[22px] w-[22px] rounded-full text-adam-text-tertiary/60 hover:text-emerald-400 bg-white/[0.03] hover:bg-emerald-400/[0.08] ring-1 ring-white/[0.06] hover:ring-emerald-400/20 transition-all"
        title="What does TEE Verified mean?"
        aria-label="What does TEE Verified mean?"
      >
        <HelpCircle className="h-3 w-3" />
      </button>

      {open && pos && createPortal(
        <motion.div
          ref={popRef}
          initial={{ opacity: 0, y: 4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
          className="fixed z-50 rounded-xl border border-white/[0.08] bg-[#1C1C1C] shadow-2xl p-4 text-left cursor-default overflow-y-auto"
          style={{ width: POPOVER_W, right: pos.right, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="font-title font-bold text-emerald-400 tracking-widest uppercase text-[10.5px] mb-2">
            What &ldquo;TEE Verified&rdquo; means
          </div>

          <p className="text-[10px] leading-relaxed text-adam-text-secondary/85 mb-2.5">
            This response was generated inside a <span className="text-white/90">TEE</span> — a sealed,
            hardware-isolated enclave — and cryptographically signed by it.
          </p>

          <div className="space-y-2.5">
            {PERKS.map((perk) => (
              <div key={perk.title} className="flex items-start gap-2">
                <Check className="h-3 w-3 text-emerald-400 mt-[3px] shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10.5px] font-semibold text-white/90">{perk.title}</div>
                  <div className="text-[9.5px] leading-relaxed text-adam-text-tertiary">{perk.body}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/[0.05] text-[9px] text-adam-text-tertiary/70">
            Powered by 0G Compute · strongest privacy on fully-enclaved (TeeML) providers
          </div>
        </motion.div>,
        document.body
      )}
    </span>
  );
}
