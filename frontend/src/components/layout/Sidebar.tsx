import { Plus, PanelLeft, PanelLeftClose } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onNewTask: () => void;
  onToggleSidebar?: () => void;
}

export function Sidebar({ isOpen, onNewTask, onToggleSidebar }: SidebarProps) {
  return (
    <div className={`${isOpen ? 'w-64' : 'w-16'} flex h-full flex-shrink-0 flex-col bg-adam-bg-dark transition-all duration-300 ease-in-out`}>
      <div className="p-4 flex items-center justify-between">
        {isOpen ? (
          <>
            <button className="flex items-center" onClick={onNewTask}>
              <span className="text-lg font-bold text-adam-text-primary tracking-tight">
                VibeCAD
              </span>
            </button>
            <button
              onClick={onToggleSidebar}
              title="Collapse sidebar"
              className="h-7 w-7 flex items-center justify-center rounded-md text-adam-text-tertiary hover:text-adam-text-primary hover:bg-adam-neutral-800 transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            onClick={onToggleSidebar}
            title="Expand sidebar"
            className="h-7 w-7 flex items-center justify-center rounded-md text-adam-text-tertiary hover:text-adam-text-primary hover:bg-adam-neutral-800 transition-colors"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={`${isOpen ? 'px-4' : 'px-2'} py-2`}>
          <div className={isOpen ? 'ml-[9px]' : 'flex justify-center'}>
            <button
              onClick={onNewTask}
              className={`${isOpen
                ? 'flex w-[216px] items-center justify-start gap-2 rounded-full border border-adam-blue bg-adam-background-1 px-4 py-3 text-adam-neutral-200 hover:bg-adam-blue/40 hover:text-adam-text-primary'
                : 'flex h-[32px] w-[32px] items-center justify-center rounded-lg bg-adam-neutral-800 text-adam-text-secondary hover:bg-adam-neutral-700 hover:text-adam-text-primary'
              } mb-4 transition-colors`}
            >
              <Plus className="h-5 w-5" />
              {isOpen && <span className="text-sm font-semibold tracking-tight">New Creation</span>}
            </button>
          </div>
        </div>
        <div className="flex-1" />
        <div className={`${isOpen ? 'px-4' : 'px-2'} py-4`}>
          {isOpen ? (
            <div className="text-[10px] text-adam-text-tertiary leading-relaxed">
              Powered by 0G Compute<br />+ Xiaomi MiMo 2.5
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-adam-blue/20 flex items-center justify-center mx-auto">
              <div className="w-2 h-2 rounded-full bg-adam-blue animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
