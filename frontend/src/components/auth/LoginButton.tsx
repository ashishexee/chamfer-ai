import { Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function LoginButton() {
  const { connect, isLoading, error } = useAuth();

  return (
    <div className="flex h-dvh items-center justify-center bg-adam-bg-dark">
      <div className="text-center">
        <h1 className="mb-2 text-3xl font-bold text-adam-text-primary">VibeCAD</h1>
        <p className="mb-8 text-sm text-adam-text-secondary">
          Connect your wallet to start building 3D models
        </p>
        <button
          onClick={() => connect()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-full bg-adam-blue px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-adam-blue/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Wallet className="h-4 w-4" />
          {isLoading ? 'Connecting...' : 'Connect Wallet'}
        </button>
        {error && (
          <p className="mt-4 text-xs text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
