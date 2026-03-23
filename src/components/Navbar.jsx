import { Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Navbar() {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">

      <div className="text-xl font-bold">Solchat</div>

      <div className="flex gap-6 text-sm">
        <Link to="/">Chat</Link>
        <Link to="/discover">Discover</Link>
        <Link to="/manifesto">Manifesto</Link>
      </div>

    </div>
  );
}