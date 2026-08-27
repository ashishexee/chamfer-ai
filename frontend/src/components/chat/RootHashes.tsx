import { useState, type ReactNode } from 'react';
import { Copy, Check, Loader2, ExternalLink, Download, ShieldCheck, Database } from 'lucide-react';
import { API_URL } from '@/lib/constants';

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

function StatusIcon({ status }: { status: string }) {
  if (status === 'uploading') return <Loader2 className="h-3.5 w-3.5 animate-spin text-adam-blue" />;
  if (status === 'done') return <Check className="h-3.5 w-3.5 text-emerald-400" />;
  return <div className="h-1.5 w-1.5 rounded-full bg-white/25" />;
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
    <div className="flex items-center justify-between gap-3 px-3.5 py-2 hover:bg-white/[0.015] transition-colors">
      <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-adam-text-tertiary">
        {label}
      </span>

      <button
        onClick={copy}
        title={`${hash} — click to copy`}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-mono text-[10.5px] tabular-nums"
      >
        <span className="truncate text-adam-text-secondary/90">{start}</span>
        <span className="shrink-0 select-none text-[9px] tracking-[0.2em] text-white/20">···</span>
        {end && <span className="shrink-0 text-adam-text-secondary/90">{end}</span>}
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md p-1 text-white/30 hover:bg-white/[0.06] hover:text-white transition-colors"
          title="View on 0G Explorer"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
        <button
          onClick={download}
          disabled={downloading}
          className="rounded-md p-1 text-white/30 hover:bg-white/[0.06] hover:text-white transition-colors disabled:opacity-40"
          title="Download from 0G"
        >
          {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
        </button>
        <button
          onClick={copy}
          className={`rounded-md p-1 transition-colors ${copied ? 'bg-emerald-500/10 text-emerald-400' : 'text-white/30 hover:bg-white/[0.06] hover:text-white'}`}
          title="Copy hash"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

function ProgressRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2 hover:bg-white/[0.015] transition-colors">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/[0.05]">
        <StatusIcon status={status} />
      </span>
      <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-adam-text-tertiary">{label}</span>
      <span className={`flex-1 text-[11px] ${status === 'uploading' ? 'text-adam-blue' : status === 'done' ? 'text-emerald-400' : 'text-adam-text-tertiary'}`}>
        {status === 'uploading' && <>Uploading to <span className="font-semibold">0G</span>…</>}
        {status === 'done' && 'Stored'}
        {status === 'skipped' && 'No data'}
        {status === 'pending' && 'Waiting…'}
      </span>
    </div>
  );
}

function Header({ icon, title, subtitle, count }: { icon: ReactNode; title: ReactNode; subtitle?: ReactNode; count?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-adam-blue/10 text-adam-blue ring-1 ring-adam-blue/15">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-title text-[11px] font-bold tracking-[0.14em] text-white">{title}</span>
          {count && (
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-adam-text-secondary ring-1 ring-white/[0.06]">
              {count}
            </span>
          )}
        </div>
        {subtitle && <div className="text-[11px] leading-none text-adam-text-tertiary">{subtitle}</div>}
      </div>
    </div>
  );
}

export function RootHashes({ hashes, txSeqs, loading, progress }: RootHashesProps) {
  const isUploading = loading && progress && Object.keys(progress).length > 0;
  const cardCls =
    'mt-3 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md shadow-[0_8px_24px_-14px_rgba(0,0,0,0.6)]';

  if (isUploading) {
    const doneCount = Object.values(progress!).filter((p) => p.status === 'done' || p.status === 'skipped').length;
    const total = FILE_META.length;
    return (
      <div className={cardCls}>
        <div className="border-b border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
          <Header
            icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />}
            title={<>Uploading to <span className="font-sans font-bold text-adam-blue">0G</span> Storage</>}
            subtitle="Content-addressed — do not close the tab"
            count={`${doneCount}/${total}`}
          />
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-adam-blue transition-all duration-500"
              style={{ width: `${(doneCount / total) * 100}%` }}
            />
          </div>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {FILE_META.map(({ key, label }) => {
            const p = progress![key];
            return <ProgressRow key={key} label={label} status={p?.status || 'pending'} />;
          })}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cardCls}>
        <div className="px-3.5 py-3">
          <Header icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />} title="STORAGE ROOT HASHES" subtitle="Fetching proofs from 0G…" />
        </div>
      </div>
    );
  }

  if (!hashes) return null;
  const entries = FILE_META.filter(({ key }) => hashes[key]);
  if (entries.length === 0) return null;

  return (
    <div className={cardCls}>
      <div className="border-b border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
        <Header
          icon={<Database className="h-3.5 w-3.5" />}
          title="STORAGE ROOT HASHES"
          subtitle="Verifiable on 0G StorageScan"
          count={`${entries.length} ${entries.length === 1 ? 'file' : 'files'}`}
        />
      </div>
      <div className="divide-y divide-white/[0.04]">
        {entries.map(({ key, label, ext, isBase64 }) => (
          <HashRow key={key} label={label} hash={hashes[key]!} txSeq={txSeqs?.[key]} ext={ext} isBase64={isBase64} />
        ))}
      </div>
      <div className="flex items-center gap-1.5 border-t border-white/[0.04] bg-white/[0.015] px-3.5 py-2 text-[10px] leading-none text-adam-text-tertiary/70">
        <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-400/60" />
        <span>Content-addressed on 0G — hashes prove what was stored</span>
      </div>
    </div>
  );
}
