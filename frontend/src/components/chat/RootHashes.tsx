import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Box,
  Boxes,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileBox,
  FileCode2,
  Loader2,
  ScanLine,
  type LucideIcon,
} from 'lucide-react';
import { API_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { RootHashData, TxSeqData } from '@/types';

// Re-exported for the existing imports that point at this module.
export type { RootHashData, TxSeqData };

export interface UploadProgress {
  [key: string]: { status: string; rootHash?: string; txSeq?: number };
}

interface RootHashesProps {
  hashes: RootHashData | null;
  txSeqs?: TxSeqData | null;
  loading: boolean;
  progress?: UploadProgress | null;
  /** Override the outer spacing (defaults to mt-3). */
  className?: string;
}

const EXPLORER_BASE = 'https://storagescan-galileo.0g.ai/submission/';

const FILE_META: {
  key: keyof RootHashData;
  label: string;
  ext: string;
  isBase64: boolean;
  icon: LucideIcon;
}[] = [
  { key: 'code', label: 'Code', ext: 'py', isBase64: false, icon: FileCode2 },
  { key: 'stl', label: 'STL', ext: 'stl', isBase64: true, icon: Box },
  { key: 'step', label: 'STEP', ext: 'step', isBase64: true, icon: FileBox },
  { key: 'glb', label: 'GLB', ext: 'glb', isBase64: true, icon: Boxes },
  { key: 'dimViews', label: 'Dim views', ext: 'json', isBase64: false, icon: ScanLine },
];

const ACTION =
  'group/action flex h-7 items-center rounded-md px-1.5 text-adam-text-tertiary outline-none transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:ring-1 focus-visible:ring-adam-accent/60 disabled:cursor-not-allowed disabled:opacity-40';

// Per-button reveal. The label sits BEFORE the icon and grows to the left, so
// the icon under the cursor never moves as the label opens.
const ACTION_LABEL =
  'max-w-0 overflow-hidden whitespace-nowrap text-right text-[10px] font-medium opacity-0 transition-[margin,max-width,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/action:mr-1.5 group-hover/action:max-w-[56px] group-hover/action:opacity-100 group-focus/action:mr-1.5 group-focus/action:max-w-[56px] group-focus/action:opacity-100';

function ActionIcon({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={active}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.7 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="flex h-3.5 w-3.5 items-center justify-center"
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={ACTION}
    >
      <span className={ACTION_LABEL}>{label}</span>
      {children}
    </button>
  );
}

function ActionLink({
  label,
  ariaLabel,
  href,
  children,
}: {
  label: string;
  ariaLabel: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className={ACTION}
    >
      <span className={ACTION_LABEL}>{label}</span>
      {children}
    </a>
  );
}

function ArtifactRow({
  label,
  icon: Icon,
  hash,
  txSeq,
  ext,
  isBase64,
}: {
  label: string;
  icon: LucideIcon;
  hash: string;
  txSeq?: number;
  ext: string;
  isBase64: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const explorerUrl = txSeq ? `${EXPLORER_BASE}${txSeq}` : `${EXPLORER_BASE}${hash}`;

  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_URL}/api/models/fetch-from-0g/${hash}?isBase64=${isBase64}`);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const data = await res.json();
      let blob: Blob;
      if (isBase64) {
        const bytes = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
        blob = new Blob([bytes], { type: 'application/octet-stream' });
      } else {
        blob = new Blob([data.data], { type: 'text/plain' });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `model.${ext}`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      console.error('[0G] Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex h-9 items-center justify-between gap-3 px-3 transition-colors hover:bg-white/[0.025]">
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-adam-text-tertiary/50" />
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-adam-text-secondary/75">
          {label}
        </span>
      </span>

      <div className="flex shrink-0 items-center gap-0.5">
        <ActionButton label={copied ? 'Copied' : 'Copy'} onClick={copy}>
          <ActionIcon active={copied ? 'check' : 'copy'}>
            {copied
              ? <Check className="h-3.5 w-3.5 text-emerald-400" />
              : <Copy className="h-3.5 w-3.5" />}
          </ActionIcon>
        </ActionButton>

        <ActionLink
          label="Open"
          ariaLabel={`Open ${label} on 0G`}
          href={explorerUrl}
        >
          <ActionIcon active="open">
            <ExternalLink className="h-3.5 w-3.5" />
          </ActionIcon>
        </ActionLink>

        <ActionButton label="Save" onClick={download} disabled={downloading}>
          <ActionIcon active={downloading ? 'loading' : 'download'}>
            {downloading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />}
          </ActionIcon>
        </ActionButton>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  icon: Icon,
  status,
}: {
  label: string;
  icon: LucideIcon;
  status: string;
}) {
  return (
    <div className="flex h-9 items-center justify-between gap-3 px-3">
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-adam-text-tertiary/50" />
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-adam-text-secondary/60">
          {label}
        </span>
      </span>
      <span
        className={cn(
          'flex items-center gap-1.5 text-[10.5px]',
          status === 'uploading' ? 'text-adam-accent' : 'text-adam-text-tertiary/70',
        )}
      >
        {status === 'uploading' && <Loader2 className="h-3 w-3 animate-spin" />}
        {status === 'uploading' && 'Uploading…'}
        {status === 'skipped' && 'No data'}
        {status === 'pending' && 'Waiting…'}
        {status === 'done' && 'Stored'}
      </span>
    </div>
  );
}

/**
 * Artifact actions for a stored version. Hashes are deliberately not rendered;
 * the row is the artifact name plus Copy / Open / Save. The whole icon group
 * shares one hover reveal, so the labels expand together in a single motion.
 */
export function RootHashes({ hashes, txSeqs, loading, progress, className }: RootHashesProps) {
  const isUploading = loading && !!progress && Object.keys(progress).length > 0;

  const rows = FILE_META.map(({ key, label, ext, isBase64, icon }) => {
    const p = progress?.[key];
    const hash = hashes?.[key] ?? p?.rootHash;
    const tx = txSeqs?.[key] ?? p?.txSeq;
    const status = hash ? 'stored' : p?.status;
    return { key, label, ext, isBase64, icon, hash, tx, status };
  }).filter((r) => r.hash || r.status);

  if (loading && !isUploading && rows.length === 0) {
    return (
      <div
        className={cn(
          'relative overflow-hidden divide-y divide-white/[0.045] rounded-2xl bg-[#202020] ring-1 ring-white/[0.05]',
          className ?? 'mt-3',
        )}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex h-9 items-center justify-between gap-3 px-3">
            <div className="h-2.5 w-16 rounded-full bg-white/[0.06]" />
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-md bg-white/[0.04]" />
              <div className="h-5 w-5 rounded-md bg-white/[0.04]" />
              <div className="h-5 w-5 rounded-md bg-white/[0.04]" />
            </div>
          </div>
        ))}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-y-0 left-0 w-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
        </div>
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        'divide-y divide-white/[0.045] overflow-hidden rounded-2xl bg-[#202020] ring-1 ring-white/[0.05]',
        className ?? 'mt-3',
      )}
    >
      {rows.map((row) =>
        row.hash ? (
          <ArtifactRow
            key={row.key}
            label={row.label}
            icon={row.icon}
            hash={row.hash}
            txSeq={row.tx}
            ext={row.ext}
            isBase64={row.isBase64}
          />
        ) : (
          <StatusRow
            key={row.key}
            label={row.label}
            icon={row.icon}
            status={row.status ?? 'pending'}
          />
        ),
      )}
    </div>
  );
}
