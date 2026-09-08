import { useEffect, useState } from 'react';
import { Plus, LogOut, Wallet, Copy, Check, Search, X, ChevronsUpDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { WalletAvatar } from '@/components/layout/WalletAvatar';
import { GlideMenu } from '@/components/ui/glide-menu';
import type { SessionListItem } from '@/types';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface SidebarProps {
  isOpen: boolean;
  onNewTask: () => void;
  onToggleSidebar?: () => void;
  walletAddress?: string;
  isConnected?: boolean;
  isAuthLoading?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  sessions?: SessionListItem[];
  activeSessionId?: string | null;
  onSelectSession?: (id: string) => void;
}

/* Width + copy-fade motion, from Beautiful UI's sidebar-nav storyboard.
 * The width uses a long decelerating curve; labels fade out immediately on
 * collapse but wait for the width on expand, so text is never caught mid-clip. */
const SIDEBAR_MOTION = {
  duration: 420,
  easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
};

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function Sidebar({
  isOpen, onNewTask, onToggleSidebar, walletAddress, isConnected,
  isAuthLoading, onConnect, onDisconnect,
  sessions, activeSessionId, onSelectSession,
}: SidebarProps) {
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

  // Close the wallet menu on outside pointer-down, Escape, or sidebar collapse
  useEffect(() => {
    if (!walletMenuOpen) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-wallet-menu]') && !target.closest('[data-wallet-trigger]')) {
        setWalletMenuOpen(false);
      }
    };
    const keyClose = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWalletMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', keyClose);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', keyClose);
    };
  }, [walletMenuOpen]);

  useEffect(() => {
    if (!isOpen) setWalletMenuOpen(false);
  }, [isOpen]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  // Label/copy fade — labels vanish immediately on collapse, but on expand
  // they wait for the width to open before sliding in
  const copyCls = `transition-[opacity,transform] ${
    isOpen
      ? 'translate-x-0 opacity-100 duration-[220ms] delay-[150ms]'
      : 'pointer-events-none -translate-x-2 opacity-0 duration-[140ms]'
  }`;

  const filteredSessions = (sessions ?? []).filter((s) =>
    s.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        data-sidebar-collapsed={!isOpen}
        aria-label="Workspace navigation"
        className="relative flex h-full shrink-0 flex-col overflow-hidden border-r border-white/[0.04] bg-adam-bg-dark pb-2 transition-[width] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          width: isOpen ? 256 : 56,
          transitionDuration: `${SIDEBAR_MOTION.duration}ms`,
        }}
      >
        {/* Fixed-width inner column — clipped by the aside while collapsing.
            flex-1 pins the wallet footer to the bottom even with a short list. */}
        <div className="flex min-h-0 w-64 flex-1 flex-col">
          {/* Header — plain wordmark + collapse control */}
          <div className="relative flex h-12 shrink-0 items-center px-2">
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Expand sidebar"
              tabIndex={isOpen ? -1 : 0}
              aria-hidden={isOpen}
              className={`absolute left-2 flex h-8 w-8 items-center justify-center rounded-lg text-adam-text-tertiary transition-[opacity,background-color,color] duration-150 hover:bg-white/[0.04] hover:text-adam-text-primary ${
                isOpen ? 'pointer-events-none opacity-0' : 'opacity-100'
              }`}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>

            <span
              className={`flex-1 whitespace-nowrap pl-2 font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold tracking-wide text-adam-text-primary ${copyCls}`}
            >
              Chamfer <span className="text-adam-blue">AI</span>
            </span>

            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Collapse sidebar"
              tabIndex={isOpen ? 0 : -1}
              aria-hidden={!isOpen}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-adam-text-tertiary transition-[opacity,background-color,color] duration-150 hover:bg-white/[0.04] hover:text-adam-text-primary ${
                isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* New Creation — simple quiet row with a plus icon */}
          <div className="relative px-3 pb-1" style={{ minHeight: 52 }}>
            <div className={`absolute inset-x-3 top-1 ${copyCls}`}>
              <button
                type="button"
                onClick={onNewTask}
                className="flex h-9 w-full items-center gap-2 rounded-lg bg-white/[0.04] px-3 text-[13px] font-medium text-adam-text-primary transition-colors duration-150 hover:bg-white/[0.07] active:scale-[0.99]"
              >
                <Plus className="h-4 w-4 shrink-0 text-adam-text-secondary" />
                New Creation
              </button>
            </div>

            <div
              className={`absolute left-2 top-1 flex justify-center ${
                isOpen ? 'pointer-events-none opacity-0' : 'opacity-100'
              }`}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onNewTask}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-adam-text-secondary transition-colors duration-150 hover:bg-white/[0.07] hover:text-white"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col">
                  <span className="font-semibold">New Creation</span>
                  <span className="text-xs text-muted-foreground">Start a new creation</span>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Chat history — persistent search bar above the list */}
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto chat-scroll">
            {isOpen && (
              <>
                <div className="mx-2 mb-1 flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 transition-colors duration-150 focus-within:bg-white/[0.06]">
                  <Search className="h-3.5 w-3.5 shrink-0 text-adam-text-tertiary" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search chats"
                    aria-label="Search chat history"
                    className="min-w-0 flex-1 bg-transparent text-[12.5px] text-adam-text-primary outline-none placeholder:text-adam-text-tertiary"
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setQuery('')}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-adam-text-tertiary transition-colors hover:text-adam-text-primary"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="px-4 pb-1 pt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-adam-text-tertiary">
                  Chat History
                </div>

                {isConnected && sessions && sessions.length > 0 && (
                  <GlideMenu className="group/glide flex flex-col gap-px px-2" highlightClassName="inset-x-0 rounded-lg bg-white/[0.05]">
                    {filteredSessions.slice(0, 30).map((s) => {
                      const active = activeSessionId === s.id;
                      return (
                        <button
                          key={s.id}
                          data-row
                          type="button"
                          onClick={() => onSelectSession?.(s.id)}
                          title={s.title}
                          className={`relative z-10 flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left transition-[background-color,color,transform] duration-150 active:scale-[0.99] ${
                            active
                              ? 'bg-white/[0.06] text-white group-hover/glide:bg-transparent'
                              : 'text-adam-text-secondary hover:text-adam-text-primary'
                          }`}
                        >
                          {active && (
                            <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-adam-blue" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                            {s.title}
                          </span>
                        </button>
                      );
                    })}
                    {filteredSessions.length === 0 && (
                      <div className="relative z-10 px-2 py-2 text-[12px] text-adam-text-tertiary">No chats found</div>
                    )}
                  </GlideMenu>
                )}
              </>
            )}
          </div>

          {/* Bottom wallet section */}
          <div className="mt-auto border-t border-white/[0.04]">
            {isOpen ? (
              <div className="px-3 py-3">
                {isConnected && walletAddress ? (
                  <div className="relative">
                    {/* Trigger — avatar, address, connection status, chevron */}
                    <button
                      type="button"
                      data-wallet-trigger
                      aria-expanded={walletMenuOpen}
                      onClick={() => setWalletMenuOpen((open) => !open)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors duration-150 hover:bg-white/[0.04]"
                    >
                      <WalletAvatar address={walletAddress} size={30} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-adam-text-primary">
                        {truncateAddress(walletAddress)}
                      </span>
                      <ChevronsUpDown
                        className={`h-3.5 w-3.5 shrink-0 text-adam-text-tertiary transition-transform duration-200 ${
                          walletMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Popover menu — opens upward from the footer */}
                    {walletMenuOpen && (
                      <div
                        data-wallet-menu
                        className="absolute bottom-full left-2 right-2 z-50 mb-2 overflow-hidden rounded-xl border border-white/[0.06] bg-[#1E1F20] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
                        style={{
                          animation: 'pop-in 180ms cubic-bezier(0.23,1,0.32,1) both',
                          transformOrigin: 'bottom left',
                        }}
                      >
                        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                          <WalletAvatar address={walletAddress} size={28} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium leading-tight text-adam-text-primary">
                              {truncateAddress(walletAddress)}
                            </span>
                            <span className="text-[10px] leading-tight text-adam-text-tertiary">
                              0G Wallet
                            </span>
                          </span>
                        </div>
                        <div className="my-1 h-px bg-white/[0.05]" />
                        <button
                          type="button"
                          onClick={handleCopy}
                          className="relative z-10 flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[12.5px] text-adam-text-secondary transition-colors duration-100 hover:bg-white/[0.04] hover:text-white"
                        >
                          {copied ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 shrink-0" />
                          )}
                          {copied ? 'Copied' : 'Copy address'}
                        </button>
                        <div className="my-1 h-px bg-white/[0.05]" />
                        <button
                          type="button"
                          onClick={() => {
                            setWalletMenuOpen(false);
                            onDisconnect?.();
                          }}
                          className="relative z-10 flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[12.5px] text-red-400/90 transition-colors duration-100 hover:bg-red-500/[0.08] hover:text-red-300"
                        >
                          <LogOut className="h-3.5 w-3.5 shrink-0" />
                          Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3 text-center">
                    <span className="mb-0.5 text-[12px] font-semibold text-adam-text-primary">
                      Wallet Not Connected
                    </span>
                    <p className="mb-2.5 text-[10px] leading-relaxed text-adam-text-tertiary">
                      Connect your wallet to start creating and saving projects.
                    </p>
                    <button
                      onClick={onConnect}
                      disabled={isAuthLoading}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-adam-blue/40 bg-adam-blue/10 py-1.5 text-[11.5px] font-semibold text-adam-blue transition-colors duration-150 hover:bg-adam-blue/20 disabled:opacity-50"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      {isAuthLoading ? 'Connecting…' : 'Connect Wallet'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-2 py-3">
                {isConnected && walletAddress ? (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={onConnect}
                          className="flex items-center justify-center rounded-md p-1 transition-colors hover:bg-white/[0.04]"
                        >
                          <WalletAvatar address={walletAddress} size={30} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="flex flex-col">
                        <span className="font-semibold">Connected Wallet</span>
                        <span className="text-xs text-muted-foreground">{truncateAddress(walletAddress)}</span>
                      </TooltipContent>
                    </Tooltip>
                    {onDisconnect && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={onDisconnect}
                            aria-label="Disconnect wallet"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-adam-text-tertiary transition-colors duration-150 hover:bg-red-500/[0.08] hover:text-red-400"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <span className="font-semibold">Disconnect wallet</span>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={onConnect}
                        disabled={isAuthLoading}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-adam-blue/25 bg-adam-blue/10 text-adam-blue transition-colors duration-150 hover:bg-adam-blue/20 disabled:opacity-50"
                      >
                        <Wallet className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="flex flex-col">
                      <span className="font-semibold">Connect Wallet</span>
                      <span className="text-xs text-muted-foreground">Sign in to save projects</span>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
