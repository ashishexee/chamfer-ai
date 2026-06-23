import { LogIn, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function HeaderAuth() {
  const { isConnected, isLoading: isAuthLoading, address: walletAddress, connect, disconnect } = useAuth();

  if (isConnected || isAuthLoading) return null;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={connect}
        className="flex items-center gap-1.5 rounded-lg border border-adam-blue/50 bg-adam-blue/10 px-4 py-1.5 text-[12px] text-adam-blue hover:bg-adam-blue/20 transition-colors font-medium"
      >
        <LogIn className="h-3.5 w-3.5" />
        Login / Sign Up
      </button>
    </div>
  );
}
