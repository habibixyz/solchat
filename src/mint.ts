import { Connection, PublicKey } from "@solana/web3.js"

const RPC = "https://api.devnet.solana.com"
const CANDY_MACHINE_ID = "YOUR_DEVNET_CANDY_MACHINE_ID"

export const mintNFT = async (provider: any) => {
  try {
    if (!provider) {
      alert("Phantom wallet not found")
      return
    }

    const resp = await provider.connect()
    const wallet = resp.publicKey

    console.log("Wallet:", wallet.toString())

    const connection = new Connection(RPC, "confirmed")
    const candyMachine = new PublicKey(CANDY_MACHINE_ID)

    console.log("Candy Machine:", candyMachine.toString())

    const account = await connection.getAccountInfo(candyMachine)

    if (!account) {
      alert("Candy Machine not found")
      return
    }

    alert("Devnet connection OK — mint wiring ready")

  } catch (err) {
    console.error(err)
    alert("Mint check failed")
  }
}