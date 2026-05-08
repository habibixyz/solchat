import {
  ConnectionProvider,
  WalletProvider
} from "@solana/wallet-adapter-react";

import {
  WalletModalProvider
} from "@solana/wallet-adapter-react-ui";

import {
  PhantomWalletAdapter,
  SolflareWalletAdapter
} from "@solana/wallet-adapter-wallets";

import { useMemo } from "react";
import type { ReactNode } from "react";

const endpoint = import.meta.env.VITE_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export const WalletContext = ({ children }: { children: ReactNode }) => {

  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter()
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};