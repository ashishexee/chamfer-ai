import { GripVertical } from 'lucide-react';
import { Group, Panel, Separator } from 'react-resizable-panels';

import { cn } from '@/lib/utils';

interface ResizablePanelGroupProps extends React.ComponentProps<typeof Group> {
  className?: string;
}

const ResizablePanelGroup = ({ className, ...props }: ResizablePanelGroupProps) => (
  <Group
    className={cn(
      'flex h-full w-full data-[panel-group-direction=vertical]:flex-col',
      className,
    )}
    {...props}
  />
);

const ResizablePanel = Panel;

interface ResizableHandleProps extends React.ComponentProps<typeof Separator> {
  withHandle?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const ResizableHandle = ({ withHandle, className, children, ...props }: ResizableHandleProps) => (
  <Separator
    className={cn(
      'group relative flex items-center justify-center z-20 cursor-col-resize',
      'bg-adam-neutral-800/50 hover:bg-adam-neutral-600/50 data-[resize-handle-state=drag]:bg-adam-blue/40 transition-colors',
      'after:absolute after:inset-y-0 after:left-1/2 after:w-5 after:-translate-x-1/2 after:content-[""]',
      !className && 'w-px',
      'data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:h-5 data-[panel-group-direction=vertical]:after:w-full',
      'data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:top-1/2 data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0',
      className,
    )}
    {...props}
  >
    {children ? (
      children
    ) : withHandle ? (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    ) : null}
  </Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
