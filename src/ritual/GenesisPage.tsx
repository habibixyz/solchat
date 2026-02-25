import { useState } from "react";
import { supabase } from "../lib/supabase";

function GenesisPage() {
  const [wallet, setWallet] = useState("");
  const [twitter, setTwitter] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidSolanaAddress = (address: string) => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  };

  const handleSubmit = async () => {
    if (loading) return;

    if (!wallet || !twitter) {
      return alert("Complete all fields.");
    }

    if (!isValidSolanaAddress(wallet)) {
      return alert("Invalid Solana wallet address.");
    }

    setLoading(true);

    const { error } = await supabase
      .from("null_genesis_allowlist")
      .insert([{ wallet, twitter }]);

    if (error) {
      if (error.code === "23505") {
        alert("Wallet already submitted.");
      } else {
        alert("Submission failed: " + error.message);
console.error("FULL ERROR:", error);
      }
    } else {
      alert("Signal recorded.");
      setWallet("");
      setTwitter("");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 pt-24 relative">
      {/* Glow (non-blocking) */}
      <div className="absolute w-[900px] h-[900px] bg-indigo-600/10 blur-[200px] rounded-full pointer-events-none"></div>

      {/* Center Content */}
      <div className="relative z-10 w-full max-w-xl text-center">

        {/* Title */}
        <h1 className="text-6xl md:text-7xl font-light tracking-[0.4em] mb-12">
          NULL SIGIL
        </h1>

        {/* Lore */}
        <p className="text-zinc-500 text-sm tracking-wide mb-16">
          The first signal precedes the system.
        </p>

        {/* Twitter Ritual Link */}
        <a
          href="https://x.com/solchatfun/status/2026293419493245024?s=20"
          target="_blank"
          rel="noreferrer"
          className="text-zinc-600 hover:text-white transition text-sm mb-14 block"
        >
          Complete the social signal →
        </a>

        {/* Tasks */}
        <div className="space-y-6 mb-16 text-left max-w-md mx-auto text-zinc-300">
          <label className="flex items-center gap-3">
            <input type="checkbox" className="accent-indigo-500" />
            <span>Like the post</span>
          </label>

          <label className="flex items-center gap-3">
            <input type="checkbox" className="accent-indigo-500" />
            <span>Comment: “I observe.”</span>
          </label>

          <label className="flex items-center gap-3">
            <input type="checkbox" className="accent-indigo-500" />
            <span>Quote with your interpretation</span>
          </label>
        </div>

        {/* Twitter Input */}
        <div className="max-w-md mx-auto">
          <input
            type="text"
            placeholder="Twitter Username (without @)"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-5 py-4 mb-6 focus:outline-none focus:border-indigo-500 transition"
          />

          {/* Wallet Input */}
          <input
            type="text"
            placeholder="Solana Wallet Address"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-5 py-4 mb-6 focus:outline-none focus:border-indigo-500 transition"
          />

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-white text-black rounded-lg py-4 text-sm tracking-widest hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "PROCESSING..." : "SUBMIT"}
          </button>
        </div>

      </div>

      {/* Footer */}
      <div className="mt-16 text-xs text-zinc-700 tracking-wide text-center">
  © 2026 · Solchat.fun · Built by{" "}
  <a
    href="https://twitter.com/ritmir11"
    target="_blank"
    rel="noreferrer"
    className="hover:text-white transition"
  >
    @ritmir11
  </a>
</div>

    </div>
  );
}

export default GenesisPage;