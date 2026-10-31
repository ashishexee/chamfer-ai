import { useState } from 'react';
import {
  Copy,
  Check,
  Eye,
  AlertTriangle,
  Pencil,
  RotateCcw,
  Shield,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Brain,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { Message } from '@/types';
import { getProviderDisplayName } from '@/lib/constants';
import { ClarificationAnswers } from './ClarificationAnswers';
import { WorkflowTimeline } from './WorkflowTimeline';
import { TeeVerifyModal } from './TeeVerifyModal';
import { TeeVerifiedInfo } from './TeeVerifiedInfo';
import { DimViews } from './DimViews';
import { CollapsibleText, isLongMessage } from './CollapsibleText';
import { REASONING_LABELS } from './ReasoningSelector';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
  index: number;
  onEdit: (index: number) => void;
  onRetry: (index: number) => void;
}

function formatTime(ts?: number) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatCost(raw: string): string {
  if (!raw) return '—';
  try {
    const wei = BigInt(raw);
    const og = Number(wei) / 1e18;
    if (og < 0.000001) return `${(og * 1e6).toFixed(0)}μ 0G`;
    if (og < 0.001) return `${(og * 1000).toFixed(1)}m 0G`;
    if (og < 1) return `${og.toFixed(4)} 0G`;
    return `${og.toFixed(2)} 0G`;
  } catch {
    return '—';
  }
}

function teeStatusLabel(status: NonNullable<NonNullable<Message['zeroG']>['teeStatus']>): string {
  switch (status) {
    case 'verified': return 'Cryptographically verified';
    case 'failed': return 'Signature verification FAILED';
    case 'not-verifiable': return 'Provider not TEE-verifiable';
    default: return 'Unverified';
  }
}

function ZeroGMetadataPanel({ zeroG }: { zeroG: NonNullable<Message['zeroG']> }) {
  const [copied, setCopied] = useState(false);
  const [receiptCopied, setReceiptCopied] = useState(false);

  const handleCopy = () => {
    const text = [
      `0G TEE Compute`,
      `Model: ${zeroG.model}`,
      `Provider: ${zeroG.providerAddress}`,
      `Request ID: ${zeroG.requestId}`,
      ...(zeroG.chatId ? [`Chat ID: ${zeroG.chatId}`] : []),
      `Tokens: ${zeroG.tokens.total} (prompt: ${zeroG.tokens.prompt}, completion: ${zeroG.tokens.completion}, reasoning: ${zeroG.tokens.reasoning})`,
      `Cost: ${formatCost(zeroG.billing.totalCost)}`,
      zeroG.teeStatus ? `TEE: ${teeStatusLabel(zeroG.teeStatus)}${zeroG.teeSource ? ` (${zeroG.teeSource})` : ''}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Everything a third party needs to re-verify the TEE signature without access to us
  const handleCopyReceipt = () => {
    const r = zeroG.teeReceipt;
    if (!r) return;
    const base = `${r.providerEndpoint ?? '{providerEndpoint}'}/signature/${zeroG.chatId ?? '{chatId}'}?model=${r.model ?? '{model}'}`;
    const text = [
      'ChamferAI · 0G TEE Verification Receipt',
      `status:            ${zeroG.teeStatus ?? 'unknown'} (independent EIP-191 check)`,
      `provider:          ${zeroG.providerAddress}`,
      ...(r.providerEndpoint ? [`providerEndpoint:  ${r.providerEndpoint}`] : []),
      ...(zeroG.chatId ? [`chatId:            ${zeroG.chatId}`] : []),
      ...(r.model ? [`model:             ${r.model}`] : []),
      `signature:         ${r.signature}`,
      ...(r.recoveredSigner ? [`recoveredSigner:   ${r.recoveredSigner}`] : []),
      `signedTextSha256:  ${r.signedTextSha256}`,
      `signedTextFormat:  ${r.signedTextFormat}`,
      '',
      'Verify it yourself:',
      `1. GET ${base}  →  {text, signature}`,
      '   (providers may purge old signatures — verify soon after generation)',
      '2. Recover the signer — must equal recoveredSigner above:',
      "   node -e \"require('ethers').verifyMessage(process.argv[1],process.argv[2]).then(console.log)\" <text> <signature>",
      '3. Integrity: sha256(text) must equal signedTextSha256 above',
      '4. On-chain: recoveredSigner must equal the provider teeSignerAddress in the',
      '   0G Compute Service record (mainnet RPC https://evmrpc.0g.ai)',
    ].join('\n');
    navigator.clipboard.writeText(text);
    setReceiptCopied(true);
    setTimeout(() => setReceiptCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mt-3 rounded-xl border border-white/[0.05] bg-white/[0.015] backdrop-blur-md overflow-hidden shadow-lg"
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-white/[0.04] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-title font-bold text-emerald-400 tracking-widest uppercase text-[11px]">
            0G TEE Compute
          </span>
          <span className="ml-auto inline-flex items-center">
            <TeeVerifiedInfo />
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.04]">
        <div className="px-3.5 py-3 text-center">
          <div className="text-[18px] font-bold text-white font-mono leading-none">
            {zeroG.tokens.total.toLocaleString()}
          </div>
          <div className="text-[9px] text-adam-text-tertiary mt-1.5 uppercase tracking-wider">Total Tokens</div>
        </div> 
        <div className="px-3.5 py-3 text-center">
          <div className="text-[18px] font-bold text-emerald-400 font-mono leading-none whitespace-nowrap">
            {formatCost(zeroG.billing.totalCost)}
          </div>
          <div className="text-[9px] text-adam-text-tertiary mt-1.5 uppercase tracking-wider">Cost</div>
        </div>
        <div className="px-3.5 py-3 text-center">
          <div className="text-[18px] font-bold text-white font-mono leading-none">
            {zeroG.tokens.reasoning.toLocaleString()}
          </div>
          <div className="text-[9px] text-adam-text-tertiary mt-1.5 uppercase tracking-wider">Reasoning</div>
        </div>
      </div>

      {/* Detail rows */}
      <div className="divide-y divide-white/[0.04] border-t border-white/[0.04]">
        <div className="flex items-center justify-between gap-3 px-3.5 py-2 hover:bg-white/[0.01] transition-all">
          <span className="text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-wider w-20 shrink-0">Model</span>
          <span className="text-[10.5px] font-mono text-adam-text-secondary/90 truncate flex-1 text-right">{zeroG.model}</span>
        </div>
        <div className="flex items-center justify-between gap-3 px-3.5 py-2 hover:bg-white/[0.01] transition-all">
          <span className="text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-wider w-20 shrink-0">Provider</span>
          <div className="flex items-center gap-1.5 flex-1 justify-end">
            <span className="text-[10.5px] font-mono text-adam-text-secondary/90">{zeroG.providerAddress.slice(0, 8)}...{zeroG.providerAddress.slice(-6)}</span>
            <button
              onClick={() => navigator.clipboard.writeText(zeroG.providerAddress)}
              className="p-1 rounded-md hover:bg-white/[0.04] text-adam-text-tertiary/40 hover:text-adam-text-tertiary transition-all"
              title="Copy address"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-3.5 py-2 hover:bg-white/[0.01] transition-all">
          <span className="text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-wider w-20 shrink-0">Request</span>
          <div className="flex items-center gap-1.5 flex-1 justify-end">
            <span className="text-[10.5px] font-mono text-adam-text-secondary/90">{zeroG.requestId.slice(0, 10)}...{zeroG.requestId.slice(-6)}</span>
            <button
              onClick={() => navigator.clipboard.writeText(zeroG.requestId)}
              className="p-1 rounded-md hover:bg-white/[0.04] text-adam-text-tertiary/40 hover:text-adam-text-tertiary transition-all"
              title="Copy request ID"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-3.5 py-2 hover:bg-white/[0.01] transition-all">
          <span className="text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-wider w-20 shrink-0">Prompt</span>
          <span className="text-[10.5px] font-mono text-adam-text-secondary/90">{zeroG.tokens.prompt.toLocaleString()} tokens</span>
        </div>
        <div className="flex items-center justify-between gap-3 px-3.5 py-2 hover:bg-white/[0.01] transition-all">
          <span className="text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-wider w-20 shrink-0">Completion</span>
          <span className="text-[10.5px] font-mono text-adam-text-secondary/90">{zeroG.tokens.completion.toLocaleString()} tokens</span>
        </div>
        {zeroG.teeStatus && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 hover:bg-white/[0.01] transition-all">
            <span className="text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-wider w-20 shrink-0">TEE</span>
            <span
              className={`text-[10.5px] font-mono text-right ${
                zeroG.teeStatus === 'verified'
                  ? 'text-emerald-400'
                  : zeroG.teeStatus === 'failed'
                    ? 'text-red-400'
                    : 'text-amber-400'
              }`}
              title={zeroG.teeDetail || undefined}
            >
              {teeStatusLabel(zeroG.teeStatus)}
              {zeroG.teeSource === 'router-only' ? ' (router-reported)' : ''}
            </span>
          </div>
        )}
        {zeroG.chatId && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 hover:bg-white/[0.01] transition-all">
            <span className="text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-wider w-20 shrink-0">Chat ID</span>
            <div className="flex items-center gap-1.5 flex-1 justify-end">
              <span className="text-[10.5px] font-mono text-adam-text-secondary/90">{zeroG.chatId.slice(0, 10)}...{zeroG.chatId.slice(-6)}</span>
              <button
                onClick={() => navigator.clipboard.writeText(zeroG.chatId!)}
                className="p-1 rounded-md hover:bg-white/[0.04] text-adam-text-tertiary/40 hover:text-adam-text-tertiary transition-all"
                title="Copy chat ID (used for TEE re-verification)"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
        {zeroG.teeReceipt?.recoveredSigner && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 hover:bg-white/[0.01] transition-all">
            <span className="text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-wider w-20 shrink-0">TEE Signer</span>
            <div className="flex items-center gap-1.5 flex-1 justify-end">
              <span className="text-[10.5px] font-mono text-adam-text-secondary/90">
                {zeroG.teeReceipt.recoveredSigner.slice(0, 8)}...{zeroG.teeReceipt.recoveredSigner.slice(-6)}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(zeroG.teeReceipt!.recoveredSigner!)}
                className="p-1 rounded-md hover:bg-white/[0.04] text-adam-text-tertiary/40 hover:text-adam-text-tertiary transition-all"
                title="Copy TEE signer address (verify it against the provider's on-chain Service record)"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer with copy all + TEE receipt */}
      <div className={`px-3.5 py-2 border-t border-white/[0.04] bg-white/[0.02] ${zeroG.teeReceipt ? 'grid grid-cols-2 gap-2' : ''}`}>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] text-adam-text-tertiary hover:text-emerald-400 transition-colors justify-center py-1 rounded-md hover:bg-emerald-400/[0.05]"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copied to clipboard</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy all metadata</span>
            </>
          )}
        </button>
        {zeroG.teeReceipt && (
          <button
            onClick={handleCopyReceipt}
            className="flex items-center gap-1.5 text-[10px] text-adam-text-tertiary hover:text-emerald-400 transition-colors justify-center py-1 rounded-md hover:bg-emerald-400/[0.05]"
            title="Copy everything needed to re-verify the TEE signature independently"
          >
            {receiptCopied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Receipt copied</span>
              </>
            ) : (
              <>
                <Shield className="h-3 w-3" />
                <span>Copy TEE receipt</span>
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function MessageBubble({ message, index, onEdit, onRetry }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const isUser = message.role === 'user';
  const isError = !!message.error;
  const isAssistant = message.role === 'assistant';
  const isBestEffort = message.bestEffort;
  // The canned "Generated with …" line is now represented by the hover footer.
  const isGeneratedSummary = isAssistant && /^\s*Generated with\b/i.test(message.content || '');
  const modelId = message.provider || message.zeroG?.model;
  const modelName = modelId ? getProviderDisplayName(modelId) : null;
  // Legacy messages predate stored timestamps; the iteration's createdAt is
  // the same generation moment, so use it rather than leaving the footer blank.
  const iterationTimestamp = message.iterations?.[0]?.createdAt
    ? Date.parse(message.iterations[0].createdAt)
    : NaN;
  const metaTimestamp =
    message.timestamp ??
    (Number.isFinite(iterationTimestamp) ? iterationTimestamp : undefined);
  const hasSpecifications =
    (message.clarificationAnswers && message.clarificationAnswers.length > 0) ||
    (message.specifications && message.specifications.length > 0);
  // Only plain user prompts collapse; specification cards keep their layout.
  const canTogglePrompt =
    isUser && !hasSpecifications && isLongMessage(message.content);

  // A successful assistant turn is represented by its Workflow/artifacts, not
  // by a canned "Generated with <model>" sentence. Legacy rows only contain
  // that sentence, so treat them as body-less and skip the empty bubble.
  const hasVisibleAssistantText =
    !!message.content?.trim() && !isGeneratedSummary;
  const hasAssistantBody =
    hasVisibleAssistantText ||
    (message.steps?.length ?? 0) > 0 ||
    (!!message.snapshots && Object.keys(message.snapshots).length > 0) ||
    (!!message.dimViews && Object.keys(message.dimViews).length > 0) ||
    !!message.zeroG ||
    !!message.warning ||
    !!message.bestEffort ||
    !!message.error ||
    !!message.visionVerified ||
    !!message.teeProof;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Specifications must not be rendered inside the "You" bubble. When the
  // user answers clarification questions the stored message has role=user
  // with clarificationAnswers/specifications — render those as a standalone
  // card separate from the You avatar card so the chat reads as:
  //   [You: original prompt] → [Specifications card] → [Assistant result]
  if (isUser && hasSpecifications) {
    const specifications = message.clarificationAnswers || message.specifications || [];
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
        className="mx-auto w-full max-w-[86%] space-y-1.5"
      >
        {message.images && message.images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {message.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Reference ${i + 1}`}
                className="h-10 w-10 rounded-lg object-cover border border-adam-neutral-700/30"
              />
            ))}
          </div>
        )}
        <ClarificationAnswers specifications={specifications} />
      </motion.div>
    );
  }

  // Generated-only legacy turns have no bubble of their own — the iteration
  // card below carries the model. Keep a hover-only edit affordance so the
  // turn remains actionable without rendering an empty box or the model label.
  if (isAssistant && !hasAssistantBody) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
        className="group/msg flex w-full justify-start"
      >
        <div className="flex h-4 w-full max-w-[92%] items-center justify-end opacity-0 transition-opacity duration-200 group-hover/msg:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(index)}
            className="flex h-4 w-4 items-center justify-center rounded text-adam-text-secondary transition-colors hover:bg-white/[0.06] hover:text-white"
            title="Edit this design"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
      className={cn('group flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'group/msg relative flex min-w-0 flex-col',
          isUser
            ? canTogglePrompt
              ? 'w-full max-w-[86%]'
              : 'max-w-[86%]'
            : 'w-full max-w-[92%]',
        )}
      >
        <div
          className={cn(
            'relative min-w-0 overflow-hidden rounded-2xl px-3.5 py-3 backdrop-blur-md',
            isUser
              ? 'rounded-2xl bg-[#2A2A2A] text-white transition-transform duration-200 ease-out group-hover/msg:-translate-x-1'
              : isError
                ? 'rounded-bl-md bg-red-500/[0.06] ring-1 ring-red-500/15'
                : 'rounded-bl-md bg-[#202020]/90 ring-1 ring-white/[0.055]',
          )}
        >
          {/* Content */}
          <div className={cn('min-w-0', isUser && 'space-y-2')}>
        {/* User images */}
        {isUser && message.images && message.images.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto">
            {message.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Reference ${i + 1}`}
                className="h-10 w-10 rounded-lg object-cover ring-1 ring-white/15"
              />
            ))}
          </div>
        )}

        {/* Assistant message body. For best-effort failures we still get a
            "Generated (best effort)..." content but the *meaningful* signal is
            the Workflow — Executing CadQuery failed — and the yellow warning
            below. Showing the canned best-effort line at the top pushes the
            real error below the fold and reads as success-with-a-note, which
            is exactly the complaint in the screenshot. Hide it when
            bestEffort is set so the Workflow sits at the top. */}
        {!(isAssistant && message.bestEffort) && !isGeneratedSummary && (
          isUser ? (
            <CollapsibleText
              text={message.content}
              className="text-sm leading-relaxed text-white/95"
              fadeClassName="from-[#2A2A2A] via-[#2A2A2A]/85 to-transparent"
              expanded={canTogglePrompt ? promptExpanded : undefined}
              onToggle={canTogglePrompt ? () => setPromptExpanded((v) => !v) : undefined}
            />
          ) : (
            <div className={cn(
              'text-sm leading-relaxed',
              isError ? 'text-red-400/90' : 'text-adam-text-primary/95'
            )}>
              {message.content}
            </div>
          )
        )}

        {/* Workflow Timeline */}
        {message.steps && message.steps.length > 0 && (
          <div className={cn(message.bestEffort ? '' : 'mt-2.5')}>
            <WorkflowTimeline steps={message.steps} reasoning={message.reasoning} />
          </div>
        )}

        {/* Inline snapshots */}
        {message.snapshots && Object.keys(message.snapshots).length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {Object.entries(message.snapshots)
              .filter(([_, svg]) => svg && !svg.includes('error'))
              .map(([view, svg]) => (
                <div key={view} className="rounded-lg overflow-hidden border border-adam-neutral-700/30 bg-adam-bg-dark/40 hover:border-adam-neutral-600/40 transition-colors">
                  <div className="h-20 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: svg }} />
                  <div className="text-center text-[8px] text-adam-text-tertiary/80 py-0.5 uppercase tracking-wider bg-adam-bg-dark/60">
                    {view}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Dim Views */}
        {message.dimViews && Object.keys(message.dimViews).length > 0 && (
          <DimViews dimViews={message.dimViews} />
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mt-2.5">
          {message.visionVerified && (
            <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-400/[0.08] rounded-full px-2.5 py-1 ring-1 ring-emerald-400/15">
              <Eye className="h-3 w-3" /> Vision-verified
            </span>
          )}
          {message.teeProof && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-400/[0.08] rounded-full px-2.5 py-1 ring-1 ring-emerald-400/15"
              title={message.teeProof.signature
                ? `Independently verified against the provider's on-chain TEE signer (chat ${message.teeProof.chatId.slice(0, 10)}...)`
                : 'Independently verified — signature receipt unavailable'}
            >
              🔒 TEE Verified{message.teeProof.signature ? ` (0x${message.teeProof.signature.slice(0, 12)}...)` : ''}
            </span>
          )}
          {message.zeroG?.chatId && (
            <button
              onClick={() => setVerifyOpen(true)}
              className="inline-flex items-center gap-1.5 text-[10px] text-adam-text-tertiary hover:text-emerald-400 bg-white/[0.03] hover:bg-emerald-400/[0.08] rounded-full px-2.5 py-1 ring-1 ring-white/[0.06] hover:ring-emerald-400/20 transition-all"
              title="Re-run TEE verification right now — see every check live"
            >
              <RefreshCw className="h-3 w-3" /> Re-verify
            </button>
          )}
          {message.zeroG?.teeStatus === 'failed' && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] text-red-400 bg-red-400/[0.08] rounded-full px-2.5 py-1 ring-1 ring-red-400/15"
              title={message.zeroG.teeDetail || 'The provider TEE signature did not verify'}
            >
              <AlertTriangle className="h-3 w-3" /> TEE verification failed
            </span>
          )}
          {!message.teeProof && message.zeroG?.teeStatus === 'unverified' && (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-400/[0.08] rounded-full px-2.5 py-1 ring-1 ring-amber-400/15"
              title={message.zeroG.teeDetail || 'Only the 0G Router reported this response as verified'}
            >
              <Shield className="h-3 w-3" /> TEE unverified
            </span>
          )}
          {message.bestEffort && (
            <span className="inline-flex items-center gap-1.5 text-[10px] text-yellow-400 bg-yellow-400/[0.08] rounded-full px-2.5 py-1 ring-1 ring-yellow-400/15">
              Best effort
            </span>
          )}
        </div>

        {/* 0G Provider Metadata */}
        {message.zeroG && (
          <ZeroGMetadataPanel zeroG={message.zeroG} />
        )}

        {/* Best-effort failure detail — placed *after* the Workflow so the
            timeline (including the red Executing CadQuery / API_ERROR line)
            is the first thing the user sees. Previously the message.content
            banner sat above the Workflow which buried the real error. */}
        {isAssistant && message.bestEffort && message.content && (
          <div className="mt-2.5 flex items-start gap-2 text-[11px] leading-relaxed text-adam-text-secondary bg-white/[0.025] rounded-lg px-3 py-2 ring-1 ring-white/[0.06]">
            <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0 text-adam-text-tertiary" />
            <span>{message.content}</span>
          </div>
        )}

        {/* Warning — hidden on bestEffort because that muted banner is
            redundant once we render the bestEffort detail above. */}
        {message.warning && !message.bestEffort && (
          <div className="mt-2.5 flex items-start gap-2 text-[11px] text-yellow-400/90 bg-yellow-500/[0.05] rounded-lg px-3 py-2 ring-1 ring-yellow-500/10">
            <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
            <span className="leading-relaxed">{message.warning}</span>
          </div>
        )}

        {/* On-demand TEE re-verification */}
        {verifyOpen && message.zeroG?.chatId && (
          <TeeVerifyModal
            onClose={() => setVerifyOpen(false)}
            providerAddress={message.zeroG.providerAddress}
            chatId={message.zeroG.chatId}
            model={message.zeroG.model}
            expectedSignedTextSha256={message.zeroG.teeReceipt?.signedTextSha256}
          />
        )}
          </div>
        </div>

        {/* Floating collapse control, outside the bubble so text keeps full width. */}
        {isUser && canTogglePrompt && (
          <button
            type="button"
            onClick={() => setPromptExpanded((v) => !v)}
            aria-expanded={promptExpanded}
            aria-label={promptExpanded ? 'Collapse message' : 'Expand message'}
            title={promptExpanded ? 'Show less' : 'Show full message'}
            className="absolute -top-2 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#2A2A2A] text-white/70 ring-1 ring-white/[0.10] transition-colors hover:bg-[#353535] hover:text-white"
          >
            {promptExpanded
              ? <ChevronUp className="h-3 w-3" />
              : <ChevronDown className="h-3 w-3" />}
          </button>
        )}

        {/* Assistant metadata — appears at the end of the bubble on hover. */}
        {!isUser && (
          <div className="pointer-events-none mt-1 flex h-4 w-full items-center gap-1.5 px-3 text-[11px] leading-none text-adam-text-secondary/90 opacity-0 transition-all duration-200 group-hover/msg:pointer-events-auto group-hover/msg:opacity-100">
            {metaTimestamp && (
              <>
                <span className="shrink-0 tabular-nums">{formatTime(metaTimestamp)}</span>
                <span className="h-2.5 w-px shrink-0 bg-white/10" />
              </>
            )}
            <span className="min-w-0 truncate">
              {modelName ?? 'Chamfer AI'}
            </span>
            {(message.reasoningEffort || message.reasoning || (message.steps && message.steps.length > 0)) && (
              <>
                <span className="h-2.5 w-px shrink-0 bg-white/10" />
                <span className="inline-flex shrink-0 items-center gap-1">
                  <Brain className="h-3 w-3" />
                  {message.reasoningEffort ? REASONING_LABELS[message.reasoningEffort] : 'Thinking'}
                </span>
              </>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => onEdit(index)}
                className="flex h-4 w-4 items-center justify-center rounded text-adam-text-secondary transition-colors hover:bg-white/[0.06] hover:text-white"
                title="Edit this design"
              >
                <Pencil className="h-3 w-3" />
              </button>
              {isBestEffort && (
                <button
                  type="button"
                  onClick={() => onRetry(index)}
                  className="flex h-4 w-4 items-center justify-center rounded text-adam-text-secondary transition-colors hover:bg-white/[0.06] hover:text-white"
                  title="Retry generation"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                onClick={handleCopy}
                className="flex h-4 w-4 items-center justify-center rounded text-adam-text-secondary transition-colors hover:bg-white/[0.06] hover:text-white"
                title={copied ? 'Copied' : 'Copy message'}
              >
                {copied
                  ? <Check className="h-3 w-3" />
                  : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        )}

        {/* Timestamp lives outside the bubble and slides in on hover. */}
        {isUser && message.timestamp && (
          <span className="pointer-events-none absolute bottom-2.5 right-full mr-2 translate-x-1.5 whitespace-nowrap text-[9.5px] tabular-nums text-adam-text-tertiary/70 opacity-0 transition-all duration-200 ease-out group-hover/msg:translate-x-0 group-hover/msg:opacity-100">
            {formatTime(message.timestamp)}
          </span>
        )}
      </div>
    </motion.div>
  );
}
