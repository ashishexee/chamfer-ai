import { useState, type ReactNode } from 'react';
import { Copy, Check, Loader2, Hash, ExternalLink, Download } from 'lucide-react';
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
  if (status === 'uploading') return <Loader2 className="h-3.5 w-3.5 text-adam-blue animate-spin" />;
  if (status === 'done') return <Check className="h-3.5 w-3.5 text-emerald-400" />;
  return <div className="w-2 h-2 rounded-full bg-adam-neutral-500" />;
}

// Quiet actions: bare icons that come alive only on hover — no borders, no boxes.
const ACTION_CLS =
  'p-1.5 rounded-md text-adam-text-tertiary hover:text-adam-blue hover:bg-white/[0.06] transition-all active:scale-95 disabled:opacity-40';

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
    setTimeout(() => setCopied(false), 2000);
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
        const bytes = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
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
    <div className="px-4 py-2.5 hover:bg-white/[0.03] transition-colors duration-150">
      <div className="flex items-center gap-3">
        <span className="text-[10.5px] font-semibold text-adam-text-secondary uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-0.5 ml-auto shrink-0">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={ACTION_CLS}
            title="View on 0G Explorer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={download}
            disabled={downloading}
            className={ACTION_CLS}
            title="Download from 0G"
          >
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={copy}
            className={ACTION_CLS}
            title="Copy full hash"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <button
        onClick={copy}
        title={`${hash} — click to copy`}
        className="mt-1.5 flex items-center w-full text-left font-mono text-[13px] tabular-nums tracking-tight truncate text-adam-text-primary/95 hover:opacity-80 transition-opacity cursor-pointer"
      >
        <span className="shrink-0">{start}</span>
        <span className="mx-1.5 shrink-0 text-adam-text-secondary tracking-[0.06em] select-none">······</span>
        {end && <span className="shrink-0 text-adam-blue/85">{end}</span>}
      </button>
    </div>
  );
}

function ProgressRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors">
      <span className="w-6 shrink-0 flex justify-center">
        <StatusIcon status={status} />
      </span>
      <span className="w-24 shrink-0 text-[10.5px] font-semibold text-adam-text-secondary uppercase tracking-wider">{label}</span>
      <span className={`text-[11.5px] flex-1 ${status === 'uploading' ? 'text-adam-blue' : status === 'done' ? 'text-adam-text-secondary' : 'text-adam-text-tertiary'}`}>
        {status === 'uploading' && <span>Uploading to <span className="text-adam-blue font-semibold">0G</span>...</span>}
        {status === 'done' && 'Stored'}
        {status === 'skipped' && 'No data'}
        {status === 'pending' && 'Waiting...'}
      </span>
    </div>
  );
}

function Header({ icon, title, count }: { icon: ReactNode; title: ReactNode; count?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <span className="font-title font-bold text-[12px] text-white uppercase tracking-widest">{title}</span>
      {count && (
        <span className="ml-auto text-[10px] font-semibold text-adam-text-secondary tabular-nums bg-white/[0.05] border border-white/[0.06] rounded-full px-2 py-0.5">
          {count}
        </span>
      )}
    </div>
  );
}

export function RootHashes({ hashes, txSeqs, loading, progress }: RootHashesProps) {
  // Progressive upload mode — show per-file status
  const isUploading = loading && progress && Object.keys(progress).length > 0;

  const cardCls = 'mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md overflow-hidden shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]';

  if (isUploading) {
    const doneCount = Object.values(progress!).filter(p => p.status === 'done' || p.status === 'skipped').length;
    return (
      <div className={cardCls}>
        <div className="px-4 py-3 border-b border-white/[0.05] bg-white/[0.02]">
          <Header
            icon={<Loader2 className="h-4 w-4 text-adam-blue animate-spin" />}
            title={<>Uploading to <span className="font-sans font-bold text-adam-blue">0G</span> Storage</>}
            count={`${doneCount}/5`}
          />
          {/* Progress bar */}
          <div className="mt-2.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-adam-blue/80 to-adam-blue transition-all duration-500"
              style={{ width: `${(doneCount / 5) * 100}%` }}
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
        <div className="px-4 py-3 border-b border-white/[0.05] bg-white/[0.02]">
          <Header icon={<Loader2 className="h-4 w-4 text-adam-blue animate-spin" />} title="Root hashes loading..." />
        </div>
      </div>
    );
  }

  if (!hashes) return null;

  const entries = FILE_META.filter(({ key }) => hashes[key]);
  if (entries.length === 0) return null;

  return (
    <div className={cardCls}>
      <div className="px-4 py-3 border-b border-white/[0.05] bg-white/[0.02]">
        <Header
          icon={<Hash className="h-4 w-4 text-adam-blue" />}
          title="Storage Root Hashes"
          count={`${entries.length} files`}
        />
      </div>
      <div className="divide-y divide-white/[0.04]">
        {entries.map(({ key, label, ext, isBase64 }) => (
          <HashRow
            key={key}
            label={label}
            hash={hashes[key]!}
            txSeq={txSeqs?.[key]}
            ext={ext}
            isBase64={isBase64}
          />
        ))}
      </div>
    </div>
  );
}
