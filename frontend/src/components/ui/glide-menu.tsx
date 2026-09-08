import { useRef, useState, type ReactNode } from 'react';

interface GlideMenuProps {
  className?: string;
  /** Classes for the gliding highlight pill (color/radius); position is computed. */
  highlightClassName?: string;
  /** Selector identifying the glidable rows inside this container. */
  rowSelector?: string;
  children: ReactNode;
}

/**
 * A single highlight that glides between rows on hover (from Beautiful
 * UI's GlideMenu concept): instead of each row toggling its own
 * background, one absolutely-positioned pill follows the pointer.
 * Rows must be marked with `rowSelector` and be `relative z-10`.
 */
export function GlideMenu({
  className = '',
  highlightClassName = 'rounded-lg bg-white/[0.05]',
  rowSelector = '[data-row]',
  children,
}: GlideMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  const [engaged, setEngaged] = useState(false);

  const handleOver = (event: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const row = (event.target as Element).closest(rowSelector) as HTMLElement | null;
    if (row && container.contains(row)) {
      setBox({ top: row.offsetTop, height: row.offsetHeight });
      setEngaged(true);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onPointerOver={handleOver}
      onPointerLeave={() => setEngaged(false)}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-1 z-0 ${highlightClassName}`}
        style={{
          top: box?.top ?? 0,
          height: box?.height ?? 0,
          opacity: box && engaged ? 1 : 0,
          transition:
            'top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease',
        }}
      />
      {children}
    </div>
  );
}
