import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { address, assets, transactions, solBalance } = await req.json();

    // Process assets
    const tokens = assets.filter((a: any) =>
      a.interface === "FungibleToken" || a.interface === "FungibleAsset"
    );
    const nfts = assets.filter((a: any) =>
      a.interface !== "FungibleToken" && a.interface !== "FungibleAsset"
    );

    const tokenCount = tokens.length;
    const nftCount = nfts.length;
    const txCount = transactions.length;

    // Top 5 tokens
    const topTokens = tokens.slice(0, 5).map((t: any) => ({
      name: t.content?.metadata?.name || t.content?.metadata?.symbol || "Unknown",
      amount: t.token_info?.balance
        ? (t.token_info.balance / Math.pow(10, t.token_info.decimals || 0)).toFixed(2)
        : "—",
    }));

    // NFT collections
    const nftNames = nfts.slice(0, 5).map((n: any) =>
      n.content?.metadata?.name || "Unknown NFT"
    ).join(", ");

    // Protocol detection from transactions
    const protocolSources = transactions
      .map((tx: any) => tx.source)
      .filter(Boolean);
    const protocolCounts: Record<string, number> = {};
    protocolSources.forEach((p: string) => {
      protocolCounts[p] = (protocolCounts[p] || 0) + 1;
    });
    const protocols = Object.entries(protocolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name.toUpperCase());

    // Tx types
    const txTypes = transactions
      .map((tx: any) => tx.type)
      .filter(Boolean)
      .join(", ");

    // Wallet age from oldest tx
    const walletAge = oldestTx?.timestamp
  ? (() => {
      const days = Math.floor((Date.now() / 1000 - oldestTx.timestamp) / 86400);
      if (days > 365) return `${Math.floor(days/365)}y ${Math.floor((days%365)/30)}m`;
      if (days > 30) return `${Math.floor(days/30)} months`;
      return `${days} days`;
    })()
  : "unknown";

    // Call Groq AI
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content: `You are an elite Solana on-chain analyst. Analyze the wallet data and return ONLY a valid JSON object with these exact fields:
{
  "summary": "3-4 sentences: overview of this wallet, what kind of user they are, their overall activity level",
  "activity": "3-4 sentences: describe their transaction patterns, frequency, what they do on-chain, any notable behaviour",
  "verdict": "3-4 sentences: direct crypto-native assessment — are they a whale, degen, flipper, long-term holder, newcomer, or farmer? Include 2 specific actionable recommendations for this wallet",
  "riskProfile": "one of: LOW, MEDIUM, HIGH, DEGEN",
  "traderType": "one of: HOLDER, FLIPPER, DEGEN, FARMER, WHALE, NEWCOMER, BUILDER"
}
Be direct, crypto-native, and specific. Reference actual data points. No fluff.
Return ONLY the JSON. No markdown, no backticks, no extra text.`,
          },
          {
            role: "user",
            content: `Wallet address: ${address}
SOL balance: ${solBalance?.toFixed(4)} SOL
Total tokens: ${tokenCount}
Total NFTs: ${nftCount}
Top tokens: ${topTokens.map((t: any) => `${t.name} (${t.amount})`).join(", ") || "none"}
NFT collections: ${nftNames || "none"}
Recent transactions (${txCount}): ${txTypes || "none"}
Protocols used: ${protocols.join(", ") || "none"}
Wallet age estimate: ${walletAge}`,
          }
        ],
      }),
    });

    const aiData = await response.json();
    const rawText = aiData?.choices?.[0]?.message?.content || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = {}; }
      }
    }

  return new Response(JSON.stringify({
  summary: parsed.summary || "Analysis unavailable",
  activity: parsed.activity || "No activity data",
  verdict: parsed.verdict || "Verdict unavailable",
  riskProfile: parsed.riskProfile || "MEDIUM",      // ← fallback
  traderType: parsed.traderType || "UNKNOWN",        // ← fallback
  tokenCount,
  nftCount,
  txCount,
  solBalance: solBalance || 0,                       // ← was missing
  topTokens: topTokens || [],                        // ← was missing
  protocols: protocols || [],                        // ← was missing
  walletAge: walletAge || "unknown",                 // ← was missing
}), {
  status: 200,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

  } catch (err: any) {
    console.error("wallet-analyze error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});