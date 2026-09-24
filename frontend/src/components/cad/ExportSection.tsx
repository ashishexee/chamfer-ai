import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { API_URL } from '@/lib/constants';

interface ExportSectionProps {
  stlBase64?: string;
  stepBase64?: string;
  exportFilename: string;
  setExportFilename: (v: string) => void;
  rootHashStl?: string;
  rootHashStep?: string;
}

export function ExportSection({ stlBase64, stepBase64, exportFilename, setExportFilename, rootHashStl, rootHashStep }: ExportSectionProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  if (!stlBase64 && !stepBase64) return null;

  const downloadFrom0G = async (rootHash: string, ext: string) => {
    setDownloading(ext);
    try {
      const res = await fetch(`${API_URL}/api/models/fetch-from-0g/${rootHash}?isBase64=true`);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const data = await res.json();
      const bytes = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportFilename || 'model'}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[0G] Download failed:', err);
    } finally {
      setDownloading(null);
    }
  };

  const downloadLocal = (base64: string, ext: string) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFilename || 'model'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = (ext: 'stl' | 'step') => {
    const rootHash = ext === 'stl' ? rootHashStl : rootHashStep;
    const base64 = ext === 'stl' ? stlBase64 : stepBase64;
    if (rootHash) {
      downloadFrom0G(rootHash, ext);
    } else if (base64) {
      downloadLocal(base64, ext);
    }
  };

  const formats = [stlBase64 ? 'stl' : null, stepBase64 ? 'step' : null].filter(Boolean) as ('stl' | 'step')[];

  return (
    <div className="px-4 pb-4">
      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="px-3.5 py-2.5">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-adam-text-tertiary">
            Filename
          </label>
          <input
            type="text"
            value={exportFilename}
            onChange={e => setExportFilename(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
            className="w-full border-b border-white/[0.08] bg-transparent px-0.5 py-1 font-mono text-[12px] text-adam-text-primary outline-none transition-colors placeholder:text-adam-text-tertiary/60 hover:border-white/[0.15] focus:border-adam-blue/60"
            placeholder="model"
          />
        </div>
        <div className="flex gap-2 border-t border-white/[0.04] px-3.5 py-2.5">
          {formats.map(ext => (
            <button
              key={ext}
              onClick={() => handleDownload(ext)}
              disabled={downloading === ext}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-medium uppercase tracking-wide text-adam-text-secondary transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            >
              {downloading === ext ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {ext}
            </button>
          ))}
        </div>
        <div className="border-t border-white/[0.04] px-3.5 py-1.5 text-[10px] text-adam-text-tertiary/70">
          Pulls from 0G Storage when available
        </div>
      </div>
    </div>
  );
}
