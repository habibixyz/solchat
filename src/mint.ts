import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import {
  mplCandyMachine,
  fetchCandyMachine,
  mintV2,
  safeFetchCandyGuard,
} from "@metaplex-foundation/mpl-candy-machine";
import { publicKey, generateSigner, transactionBuilder } from "@metaplex-foundation/umi";
import { setComputeUnitLimit } from "@metaplex-foundation/mpl-toolbox";

const CANDY_MACHINE_ID = "4XYkdFoqMdVCoGZgKCsgaRegTq25rMCoRdDJb2ZG2QPy";
const RPC = "https://api.devnet.solana.com";

export const mintNFT = async (walletAdapter: any) => {
  try {
    if (!walletAdapter?.publicKey) {
      alert("Connect your wallet first");
      return;
    }

    // Setup UMI
    const umi = createUmi(RPC)
      .use(walletAdapterIdentity(walletAdapter))
      .use(mplCandyMachine())

    const candyMachineId = publicKey(CANDY_MACHINE_ID);

    // Fetch Candy Machine
    const candyMachine = await fetchCandyMachine(umi, candyMachineId);
    const candyGuard = await safeFetchCandyGuard(umi, candyMachine.mintAuthority);

    console.log("Candy Machine loaded:", candyMachine.publicKey);
    console.log("Items available:", candyMachine.data.itemsAvailable);
    console.log("Items minted:", candyMachine.itemsRedeemed);

    // Check if sold out
    if (candyMachine.itemsRedeemed >= candyMachine.data.itemsAvailable) {
      alert("Sold out!");
      return;
    }

    // Generate NFT mint signer
    const nftMint = generateSigner(umi);

    // Build and send mint transaction
    await transactionBuilder()
      .add(setComputeUnitLimit(umi, { units: 800_000 }))
      .add(
        mintV2(umi, {
          candyMachine: candyMachine.publicKey,
          candyGuard: candyGuard?.publicKey,
          nftMint,
          collectionMint: candyMachine.collectionMint,
          collectionUpdateAuthority: candyMachine.authority,
        })
      )
      .sendAndConfirm(umi, {
        confirm: { commitment: "confirmed" },
      });

    alert("✅ Null Sigil minted successfully!");
    console.log("NFT mint address:", nftMint.publicKey);
    return nftMint.publicKey;

  } catch (err: any) {
    console.error("Mint error:", err);
    alert(`Mint failed: ${err.message}`);
  }
};