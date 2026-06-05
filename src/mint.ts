import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

export const mintNFT = async (walletAdapter: any, serverWalletAddress: string, rpcUrl: string) => {
  try {
    if (!walletAdapter?.publicKey) {
      alert("Connect your wallet first");
      return null;
    }
    if (!serverWalletAddress) {
      alert("Server wallet address is not configured");
      return null;
    }

    const connection = new Connection(rpcUrl, "confirmed");
    const fromPubkey = walletAdapter.publicKey;
    const toPubkey = new PublicKey(serverWalletAddress);

    // Create a transaction to transfer 0.001 SOL
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: 0.001 * LAMPORTS_PER_SOL, // 0.001 SOL (1,000,000 lamports)
      })
    );

    // Fetch recent blockhash
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = fromPubkey;

    // Request user signature and send transaction
    const signedTx = await walletAdapter.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signedTx.serialize());

    console.log("Transaction sent. Signature:", signature);
    
    // Wait for network confirmation
    await connection.confirmTransaction(signature, "confirmed");
    
    return signature;
  } catch (err: any) {
    console.error("Payment transaction failed:", err);
    throw err;
  }
};
