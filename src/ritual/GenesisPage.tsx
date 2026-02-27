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
  console.log("Supabase error:", error);

  if (error.code === "23505" && error.message.includes("wallet")) {
    alert("Wallet already submitted.");
  } else {
    alert("Submission failed: " + error.message);
  }

  setLoading(false);
  return;
} else {
      alert("Signal recorded.");
      setWallet("");
      setTwitter("");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">

          <h1 className="text-5xl md:text-6xl font-light tracking-[0.4em] mb-10">
            NULL SIGIL
          </h1>

          <p className="text-zinc-500 text-sm mb-8">
            The first signal precedes the system.
          </p>

          <a
            href="https://x.com/solchatfun/status/2026293419493245024?s=20"
            target="_blank"
            rel="noreferrer"
            className="block text-sm text-zinc-500 hover:text-white transition mb-10"
          >
            Complete the social signal →
          </a>

          <div className="space-y-5 text-left text-zinc-300 mb-10">
            <label className="flex items-center gap-3">
              <input type="checkbox" className="accent-indigo-500" />
              Like the post
            </label>

            <label className="flex items-center gap-3">
              <input type="checkbox" className="accent-indigo-500" />
              Comment: “I observe.”
            </label>

            <label className="flex items-center gap-3">
              <input type="checkbox" className="accent-indigo-500" />
              Quote with your interpretation
            </label>
          </div>

          <input
            type="text"
            placeholder="Twitter Username (without @)"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:border-indigo-500 transition"
          />

          <input
            type="text"
            placeholder="Solana Wallet Address"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 mb-6 focus:outline-none focus:border-indigo-500 transition"
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-white text-black rounded-lg py-3 tracking-widest hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "PROCESSING..." : "SUBMIT"}
          </button>

        </div>
      </div>

      <div className="text-center text-xs text-zinc-600 py-6">
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