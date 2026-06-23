import { useState } from 'react';
import { ArrowUp, X, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface EditInputProps {
  originalPrompt: string;
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
}

export function EditInput({ originalPrompt, onSubmit, onCancel }: EditInputProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onSubmit(prompt.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-3.5 my-2 rounded-xl border border-adam-blue/20 bg-adam-blue/[0.04] p-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <Wand2 className="h-3.5 w-3.5 text-adam-blue" />
        <span className="text-[11px] text-adam-blue font-medium">Edit previous design</span>
        <span className="text-[10px] text-adam-text-tertiary/60 flex-1 truncate">
          Original: {originalPrompt}
        </span>
      </div>
      <textarea
        className="w-full bg-adam-bg-dark/60 rounded-lg px-3 py-2 text-sm text-adam-text-primary resize-none outline-none border border-adam-neutral-700/30 focus:border-adam-blue/40 placeholder:text-adam-text-tertiary/50"
        rows={2}
        placeholder="Describe what you want to change..."
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
        autoFocus
      />
      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 text-[11px] text-adam-text-tertiary hover:text-adam-text-secondary px-2 py-1 rounded-md hover:bg-white/[0.04] transition-colors"
        >
          <X className="h-3 w-3" /> Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim()}
          className={cn(
            'flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md transition-all',
            prompt.trim()
              ? 'bg-adam-blue text-white hover:bg-adam-blue/90'
              : 'bg-adam-neutral-800 text-adam-text-tertiary cursor-not-allowed'
          )}
        >
          <ArrowUp className="h-3 w-3" /> Update
        </button>
      </div>
    </motion.div>
  );
}
