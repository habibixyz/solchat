import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export default function App() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
      <h1 className="text-5xl font-bold text-cyan-400 drop-shadow-[0_0_25px_#22d3ee]">
        Solchat 🚀
      </h1>

      <WalletMultiButton className="!bg-cyan-500 hover:!bg-cyan-400 !text-black" />
    </div>
  )
}
