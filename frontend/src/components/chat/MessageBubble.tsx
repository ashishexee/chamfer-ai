import { useState } from 'react';
import { User, Copy, Check, Eye, AlertTriangle, Pencil, RotateCcw, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Message } from '@/types';
import { getProviderDisplayName } from '@/lib/constants';
import { NutIcon } from '@/components/hardware/NutIcon';
import { ClarificationAnswers } from './ClarificationAnswers';
import { WorkflowTimeline } from './WorkflowTimeline';
import { DimViews } from './DimViews';
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

function ZeroGMetadataPanel({ zeroG }: { zeroG: NonNullable<Message['zeroG']> }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = [
      `0G TEE Compute`,
      `Model: ${zeroG.model}`,
      `Provider: ${zeroG.providerAddress}`,
      `Request ID: ${zeroG.requestId}`,
      `Tokens: ${zeroG.tokens.total} (prompt: ${zeroG.tokens.prompt}, completion: ${zeroG.tokens.completion}, reasoning: ${zeroG.tokens.reasoning})`,
      `Cost: ${formatCost(zeroG.billing.totalCost)}`,
      zeroG.teeVerified ? `TEE Verified: Yes` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      </div>

      {/* Footer with copy all */}
      <div className="px-3.5 py-2 border-t border-white/[0.04] bg-white/[0.02]">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] text-adam-text-tertiary hover:text-emerald-400 transition-colors w-full justify-center py-1 rounded-md hover:bg-emerald-400/[0.05]"
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
      </div>
    </motion.div>
  );
}

export function MessageBubble({ message, index, onEdit, onRetry }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isError = !!message.error;
  const isAssistant = message.role === 'assistant';
  const hasContent = isAssistant && message.content && !message.clarification;
  const isBestEffort = message.bestEffort;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
      className={cn(
        'group relative rounded-xl border transition-colors',
        isUser
          ? 'border-adam-neutral-700/25 bg-adam-neutral-800/25'
          : isError
          ? 'border-red-500/20 bg-red-500/[0.04]'
          : 'border-adam-neutral-700/25 bg-adam-background-1/40'
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
        {/* Avatar */}
        <div className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          isUser
            ? 'bg-adam-neutral-700/60 text-adam-text-secondary ring-1 ring-white/[0.04]'
            : isError
            ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/15'
            : 'bg-gradient-to-br from-adam-blue/25 to-adam-blue/[0.08] text-adam-blue ring-1 ring-adam-blue/20'
        )}>
          {isUser
            ? <User className="h-3.5 w-3.5" />
            : isError
            ? <AlertTriangle className="h-3.5 w-3.5" />
            : <NutIcon className="h-3.5 w-3.5" />}
        </div>

        {/* Name + timestamp */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className={cn(
            'font-title font-bold truncate tracking-wide',
            isUser ? 'text-adam-text-secondary' : isError ? 'text-red-400' : 'text-adam-text-primary'
          )}>
            {isUser ? 'You' : message.provider ? getProviderDisplayName(message.provider) : 'Chamfer AI'}
          </span>
          {message.timestamp && (
            <span className="text-[10px] text-adam-text-tertiary/70 shrink-0 tabular-nums">
              {formatTime(message.timestamp)}
            </span>
          )}
          {!isUser && !isError && message.content && !message.bestEffort && (
            <span className="hidden group-hover:block text-[9px] text-adam-text-tertiary/50">
              · {message.visionVerified ? 'vision-verified' : 'generated'}
            </span>
          )}
        </div>

        {/* Action buttons */}
        {hasContent && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <button
              onClick={() => onEdit(index)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-adam-text-tertiary hover:text-adam-blue hover:bg-adam-blue/10 transition-colors"
              title="Edit this design"
            >
              <Pencil className="h-3 w-3" />
            </button>
            {isBestEffort && (
              <button
                onClick={() => onRetry(index)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-adam-text-tertiary hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                title="Retry generation"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex h-6 w-6 items-center justify-center rounded-md text-adam-text-tertiary hover:text-adam-text-secondary hover:bg-white/[0.04] transition-colors"
              title={copied ? 'Copied' : 'Copy message'}
            >
              {copied
                ? <Check className="h-3 w-3 text-emerald-400" />
                : <Copy className="h-3 w-3" />}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-3.5 pb-3.5">
        {/* User images */}
        {isUser && message.images && message.images.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto">
            {message.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Reference ${i + 1}`}
                className="w-20 h-20 rounded-lg object-cover border border-adam-neutral-700/30"
              />
            ))}
          </div>
        )}

        {(message.clarificationAnswers && message.clarificationAnswers.length > 0) || (message.specifications && message.specifications.length > 0) ? (
          <ClarificationAnswers specifications={message.clarificationAnswers || message.specifications || []} />
        ) : (
          <div className={cn(
            'text-sm leading-relaxed',
            isError ? 'text-red-400/90' : 'text-adam-text-primary/95'
          )}>
            {message.content}
          </div>
        )}

        {/* Workflow Timeline */}
        {message.steps && message.steps.length > 0 && (
          <div className="mt-2.5">
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
            <span className="inline-flex items-center gap-1.5 text-[10px] text-blue-400 bg-blue-400/[0.08] rounded-full px-2.5 py-1 ring-1 ring-blue-400/15">
              🔒 TEE Verified (0x{message.teeProof.signature.slice(0, 12)}...)
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

        {/* Warning */}
        {message.warning && (
          <div className="mt-2.5 flex items-start gap-2 text-[11px] text-yellow-400/90 bg-yellow-500/[0.05] rounded-lg px-3 py-2 ring-1 ring-yellow-500/10">
            <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
            <span className="leading-relaxed">{message.warning}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
