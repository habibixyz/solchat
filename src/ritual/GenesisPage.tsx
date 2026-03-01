import { useState } from "react";
import { supabase } from "../lib/supabase";

function GenesisPage() {
  const [twitter, setTwitter] = useState("");
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidSolanaAddress = (address: string) => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  };

  const handleSubmit = async () => {
    if (!wallet || !twitter) {
      alert("Complete all fields.");
      return;
    }

    if (!isValidSolanaAddress(wallet)) {
      alert("Invalid Solana wallet address.");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("null_genesis_allowlist")
      .insert([{ wallet, twitter }]);

    if (error) {
      alert("Submission failed.");
      setLoading(false);
      return;
    }

    alert("Signal recorded.");
    setTwitter("");
    setWallet("");
    setLoading(false);
  };

  return (
    <div className="genesis-shell">
      <div className="genesis-card">

        <h1 className="genesis-title">NULL SIGIL</h1>

        <p className="genesis-sub">
          The first signal precedes the system.
        </p>

        <a
          href="https://x.com/solchatfun/status/2026293419493245024?s=20"
          target="_blank"
          rel="noreferrer"
          className="genesis-link"
        >
          Complete the social signal →
        </a>

        <p className="genesis-instructions">
  Like · Comment “I observe.” · Quote your interpretation
</p>

        <input
          type="text"
          placeholder="Twitter Username (without @)"
          value={twitter}
          onChange={(e) => setTwitter(e.target.value)}
        />

        <input
          type="text"
          placeholder="Solana Wallet Address"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
        />

        <button onClick={handleSubmit}>
          {loading ? "PROCESSING..." : "COMPLETE SIGNAL"}
        </button>

      </div>
    </div>
  );
}

export default GenesisPage;