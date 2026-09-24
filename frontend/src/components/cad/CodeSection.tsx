import { Download } from 'lucide-react';
import CodeBlock from '@/components/ui/code-block';

interface CodeSectionProps {
  code: string;
}

export function CodeSection({ code }: CodeSectionProps) {
  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 pb-4">
      <CodeBlock
        variant="Code"
        language="python"
        lines={code.split('\n')}
        filename="model.py"
        actions={
          <button
            type="button"
            aria-label="Download code"
            onClick={handleDownload}
            className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[11.5px] font-medium text-adam-text-tertiary transition-colors duration-100 hover:bg-white/[0.05] hover:text-adam-text-secondary"
          >
            <Download className="h-3 w-3" />
            Download
          </button>
        }
      />
    </div>
  );
}
