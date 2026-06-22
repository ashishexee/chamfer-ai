import { useState } from 'react';
import { User, Copy, Check, Eye, AlertTriangle } from 'lucide-react';
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
}

function formatTime(ts?: number) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isError = !!message.error;

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
            'text-xs font-semibold truncate',
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

        {/* Copy button — assistant messages with content */}
        {!isUser && !isError && message.content && (
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-all duration-200 flex h-6 w-6 items-center justify-center rounded-md text-adam-text-tertiary hover:text-adam-text-secondary hover:bg-white/[0.04]"
            title={copied ? 'Copied' : 'Copy message'}
          >
            {copied
              ? <Check className="h-3 w-3 text-emerald-400" />
              : <Copy className="h-3 w-3" />}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-3.5 pb-3.5">
        {message.clarificationAnswers && message.clarificationAnswers.length > 0 ? (
          <ClarificationAnswers answers={message.clarificationAnswers} />
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
