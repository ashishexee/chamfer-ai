import { type Web3AuthContextConfig } from '@web3auth/modal/react';
import { WEB3AUTH_NETWORK } from '@web3auth/modal';

const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID;

const web3AuthContextConfig: Web3AuthContextConfig = {
  web3AuthOptions: {
    clientId,
    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
    sessionTime: 86400 * 7,
    storageType: 'local',
  },
};

export default web3AuthContextConfig;
