import { useState } from 'react';
import { Check, ChevronRight, Copy, ExternalLink, Download, Loader2 } from 'lucide-react';
import { API_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';

export interface RootHashData {
  code?: string;
  stl?: string;
  step?: string;
  glb?: string;
  dimViews?: string;
}

export interface TxSeqData {
  code?: number;
  stl?: number;
  step?: number;
  glb?: number;
  dimViews?: number;
}

export interface UploadProgress {
  [key: string]: { status: string; rootHash?: string; txSeq?: number };
}

interface RootHashesProps {
  hashes: RootHashData | null;
  txSeqs?: TxSeqData | null;
  loading: boolean;
  progress?: UploadProgress | null;
  /** Initial expanded state — caller varies it per message (newest open, history collapsed). */
  defaultExpanded?: boolean;
}

const EXPLORER_BASE = 'https://storagescan-galileo.0g.ai/submission/';

const FILE_META: { key: keyof RootHashData; label: string; ext: string; isBase64: boolean }[] = [
  { key: 'code', label: 'Code', ext: 'py', isBase64: false },
  { key: 'stl', label: 'STL', ext: 'stl', isBase64: true },
  { key: 'step', label: 'STEP', ext: 'step', isBase64: true },
  { key: 'glb', label: 'GLB', ext: 'glb', isBase64: true },
  { key: 'dimViews', label: 'Dim Views', ext: 'json', isBase64: false },
];

function truncateHashParts(hash: string): { start: string; end: string } {
  if (hash.length <= 16) return { start: hash, end: '' };
  return { start: hash.slice(0, 10), end: hash.slice(-6) };
}

function HashRow({ label, hash, txSeq, ext, isBase64 }: {
  label: string;
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
    setTimeout(() => setCopied(false), 1800);
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
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[0G] Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const { start, end } = truncateHashParts(hash);

  return (
    <div className="flex items-center gap-3 px-3.5 py-1.5 transition-colors hover:bg-white/[0.02]">
      <span className="w-16 shrink-0 text-[10px] font-medium uppercase tracking-wider text-adam-text-tertiary/80">
        {label}
      </span>

      <span className="flex min-w-0 flex-1 items-center gap-1.5 font-mono text-[10.5px] tabular-nums">
        <span className="truncate text-adam-text-secondary/80">{start}</span>
        <span className="shrink-0 select-none text-[9px] tracking-[0.2em] text-white/15">···</span>
        {end && <span className="shrink-0 text-adam-text-secondary/80">{end}</span>}
      </span>

      {/* Always visible — touch devices have no hover */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={copy}
          aria-label={`Copy ${label} hash`}
          className={cn(
            'rounded-md p-1 transition-colors hover:bg-white/[0.06]',
            copied ? 'text-emerald-400' : 'text-white/30 hover:text-white',
          )}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${label} on 0G Explorer`}
          className="rounded-md p-1 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
        <button
          onClick={download}
          disabled={downloading}
          aria-label={`Download ${label} from 0G`}
          className="rounded-md p-1 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
        >
          {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

/** In-flight row — a file that hasn't landed on 0G yet. */
function ProgressRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-1.5">
      <span className="w-16 shrink-0 text-[10px] font-medium uppercase tracking-wider text-adam-text-tertiary/80">
        {label}
      </span>
      <span
        className={cn(
          'flex-1 text-[11px]',
          status === 'uploading' ? 'text-adam-blue' : 'text-adam-text-tertiary/70',
        )}
      >
        {status === 'uploading' && 'Uploading…'}
        {status === 'done' && 'Stored'}
        {status === 'skipped' && 'No data'}
        {status === 'pending' && 'Waiting…'}
      </span>
      <span className="flex w-4 shrink-0 items-center justify-center">
        {status === 'uploading' && <Loader2 className="h-3 w-3 animate-spin text-adam-blue" />}
        {status === 'done' && <Check className="h-3 w-3 text-emerald-400" />}
        {status === 'pending' && <span className="h-1.5 w-1.5 rounded-full ring-1 ring-white/20" />}
      </span>
    </div>
  );
}

export function RootHashes({ hashes, txSeqs, loading, progress, defaultExpanded = true }: RootHashesProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isUploading = loading && !!progress && Object.keys(progress).length > 0;
  const cardCls =
    'mt-3 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md shadow-[0_8px_24px_-14px_rgba(0,0,0,0.6)]';

  // Proofs are being fetched but no per-file progress has arrived yet
  if (loading && !isUploading) {
    return (
      <div className={cardCls}>
        <div className="flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-medium text-adam-text-secondary">
          <Loader2 className="h-3 w-3 animate-spin text-adam-blue" />
          Fetching proofs from 0G…
        </div>
      </div>
    );
  }

  // One unified row per artifact, merging live upload progress with the
  // final hashes — a row becomes actionable the moment its hash exists.
  const rows = FILE_META.map(({ key, label, ext, isBase64 }) => {
    const p = progress?.[key];
    const hash = hashes?.[key] ?? p?.rootHash;
    const tx = txSeqs?.[key] ?? p?.txSeq;
    const status = hash ? 'stored' : p?.status ?? (loading ? 'pending' : undefined);
    return { key, label, ext, isBase64, hash, tx, status };
  }).filter((r) => r.hash || r.status);

  if (rows.length === 0) return null;

  const storedRows = rows.filter((r) => r.hash);
  const inFlight = !!loading && rows.some((r) => !r.hash && (r.status === 'uploading' || r.status === 'pending'));

  return (
    <div className={cardCls}>
      {/* Collapsible section header — same grammar as the right-panel accordions */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full select-none items-center gap-1.5 px-3.5 py-2 transition-colors hover:bg-white/[0.02]"
        title="Content-addressed on 0G — hashes prove what was stored and are verifiable on 0G StorageScan"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 text-adam-text-tertiary/70 transition-transform duration-200 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
        <span className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-medium text-adam-text-secondary">
          {inFlight && <Loader2 className="h-3 w-3 animate-spin text-adam-blue" />}
          {inFlight ? 'Uploading to 0G' : 'Stored on 0G'}
        </span>
        <span className="font-mono text-[10.5px] tabular-nums text-adam-text-tertiary">
          {inFlight
            ? `${storedRows.length}/${FILE_META.length}`
            : `${storedRows.length} ${storedRows.length === 1 ? 'file' : 'files'}`}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.04] py-1">
          {rows.map((r) =>
            r.hash ? (
              <HashRow key={r.key} label={r.label} hash={r.hash} txSeq={r.tx} ext={r.ext} isBase64={r.isBase64} />
            ) : (
              <ProgressRow key={r.key} label={r.label} status={r.status!} />
            ),
          )}
        </div>
      )}

      {inFlight && (
        <div className="px-3.5 pb-2">
          <div className="h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-adam-blue transition-all duration-500"
              style={{ width: `${(storedRows.length / FILE_META.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
