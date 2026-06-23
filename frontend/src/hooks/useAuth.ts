import { useWeb3AuthConnect, useWeb3AuthDisconnect } from '@web3auth/modal/react';
import { useConnection } from 'wagmi';
import { useCallback, useState } from 'react';

export interface AuthState {
  isConnected: boolean;
  isLoading: boolean;
  address: string | undefined;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  getAuthHeader: () => string;
}

export function useAuth(): AuthState {
  const { connect: w3aConnect, loading, isConnected } = useWeb3AuthConnect();
  const { disconnect: w3aDisconnect } = useWeb3AuthDisconnect();
  const { address } = useConnection();
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    try {
      await w3aConnect();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [w3aConnect]);

  const disconnect = useCallback(async () => {
    setError(null);
    try {
      await w3aDisconnect();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [w3aDisconnect]);

  const getAuthHeader = useCallback((): string => {
    return address || '';
  }, [address]);

  return {
    isConnected,
    isLoading: loading,
    address,
    error,
    connect,
    disconnect,
    getAuthHeader,
  };
}
