import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, RefreshCw, Loader2, Check, AlertTriangle, ShieldCheck, Copy, ShieldQuestion } from 'lucide-react';
import { API_URL } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import type { TeeVerifyResponse } from '@/types';

interface TeeVerifyModalProps {
  onClose: () => void;
  providerAddress: string;
  chatId: string;
  model?: string;
  expectedSignedTextSha256?: string;
}

/**
 * On-demand, user-triggered TEE re-verification. Runs the full independent check
 * against the provider and the 0G chain via POST /api/tee/verify and shows every
 * step's outcome — full transparency, no trust in our own badge required.
 */
export function TeeVerifyModal({ onClose, providerAddress, chatId, model, expectedSignedTextSha256 }: TeeVerifyModalProps) {
  const { isConnected, getAuthHeader } = useAuth();
  const [running, setRunning] = useState(false);
  const [resp, setResp] = useState<TeeVerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    setResp(null);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/tee/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isConnected ? { Authorization: `Bearer ${getAuthHeader()}` } : {}),
        },
        body: JSON.stringify({ providerAddress, chatId, model, expectedSignedTextSha256 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setResp(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [isConnected, getAuthHeader, providerAddress, chatId, model, expectedSignedTextSha256]);

  useEffect(() => { run(); }, [run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCopyReceipt = () => {
    if (!resp?.receipt) return;
    const r = resp.receipt;
    const text = JSON.stringify({
      status: resp.status,
      provider: providerAddress,
      providerEndpoint: r.providerEndpoint,
      chatId,
      model: r.model ?? model,
      signature: r.signature,
      recoveredSigner: r.recoveredSigner,
      signedTextSha256: r.signedTextSha256,
      signedTextFormat: r.signedTextFormat,
      verifiedAt: new Date().toISOString(),
      howToVerify: `GET ${r.providerEndpoint}/signature/${chatId}?model=${r.model ?? model} → verifyMessage(text, signature) must equal the provider's on-chain teeSignerAddress`,
    }, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const verdict = resp && {
    verified: { icon: <ShieldCheck className="h-4 w-4" />, cls: 'text-emerald-400 bg-emerald-400/[0.08] ring-emerald-400/20', text: 'Verified — the TEE-attested signer signed this response' },
    failed: { icon: <AlertTriangle className="h-4 w-4" />, cls: 'text-red-400 bg-red-400/[0.08] ring-red-400/20', text: 'Verification FAILED — treat this response as untrusted' },
    unverified: { icon: <ShieldQuestion className="h-4 w-4" />, cls: 'text-amber-400 bg-amber-400/[0.08] ring-amber-400/20', text: 'Could not verify independently right now' },
    'not-verifiable': { icon: <ShieldQuestion className="h-4 w-4" />, cls: 'text-amber-400 bg-amber-400/[0.08] ring-amber-400/20', text: 'This provider has no verifiable TEE service' },
  }[resp.status];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md rounded-2xl border border-white/[0.07] bg-[#0b0d10] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="font-title font-bold text-emerald-400 tracking-widest uppercase text-[11px]">TEE Verification</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/[0.05] text-adam-text-tertiary hover:text-white transition-all" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Target */}
        <div className="px-4 pt-3 pb-2 space-y-1">
          <Row label="Provider" value={`${providerAddress.slice(0, 10)}…${providerAddress.slice(-6)}`} />
          <Row label="Chat ID" value={`${chatId.slice(0, 12)}…${chatId.slice(-6)}`} />
          {model && <Row label="Model" value={model} />}
        </div>

        {/* Body */}
        <div className="px-4 pb-3">
          {running && (
            <div className="flex items-center gap-2.5 py-4 text-[11px] text-adam-text-secondary">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
              Re-running verification against the provider and the 0G chain…
            </div>
          )}

          {!running && error && (
            <div className="py-3">
              <div className="flex items-start gap-2 text-[11px] text-red-400 bg-red-400/[0.06] ring-1 ring-red-400/15 rounded-lg px-3 py-2.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Verification could not run: {error}</span>
              </div>
              <button
                onClick={run}
                className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-[10px] text-adam-text-tertiary hover:text-emerald-400 transition-colors py-1.5 rounded-md hover:bg-emerald-400/[0.05]"
              >
                <RefreshCw className="h-3 w-3" /> Try again
              </button>
            </div>
          )}

          {!running && resp && (
            <>
              <div className="divide-y divide-white/[0.04] rounded-lg border border-white/[0.05] overflow-hidden">
                {resp.steps.map((step, i) => (
                  <motion.div
                    key={step.key}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.08 }}
                    className="flex items-start gap-2.5 px-3 py-2.5 bg-white/[0.01]"
                  >
                    {step.pass === true ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    ) : step.pass === false ? (
                      <X className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className={`text-[11px] ${step.pass === false ? 'text-red-400' : step.pass === true ? 'text-white/90' : 'text-amber-400'}`}>
                        {step.label}
                      </div>
                      {step.detail && (
                        <div className="text-[9.5px] font-mono text-adam-text-tertiary/70 truncate mt-0.5" title={step.detail}>
                          {step.detail}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {verdict && (
                <div className={`mt-3 flex items-center gap-2 text-[11px] rounded-lg px-3 py-2.5 ring-1 ${verdict.cls}`}>
                  {verdict.icon}
                  <span>{verdict.text}</span>
                </div>
              )}
              {resp.detail && resp.status !== 'verified' && (
                <div className="mt-1.5 text-[9.5px] text-adam-text-tertiary/70 px-1">{resp.detail}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`px-4 py-2.5 border-t border-white/[0.05] bg-white/[0.02] flex items-center gap-2 ${resp?.receipt ? 'justify-between' : 'justify-end'}`}>
          {resp?.receipt && (
            <button
              onClick={handleCopyReceipt}
              className="flex items-center gap-1.5 text-[10px] text-adam-text-tertiary hover:text-emerald-400 transition-colors py-1 px-2 rounded-md hover:bg-emerald-400/[0.05]"
              title="Copy the full verification receipt (JSON) to share or re-verify elsewhere"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Receipt copied' : 'Copy receipt (JSON)'}
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[10px] text-adam-text-tertiary hover:text-white transition-colors py-1 px-3 rounded-md hover:bg-white/[0.05]"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[9.5px] font-semibold text-adam-text-tertiary uppercase tracking-wider w-16 shrink-0">{label}</span>
      <span className="text-[10.5px] font-mono text-adam-text-secondary/90 truncate">{value}</span>
    </div>
  );
}
