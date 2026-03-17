import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    for (const tx of body) {
      // Only process large transfers
      const nativeTransfers = tx.nativeTransfers || [];
      const tokenTransfers = tx.tokenTransfers || [];

      // Large SOL transfers
      for (const transfer of nativeTransfers) {
        const amountSol = transfer.amount / 1e9;
        if (amountSol < 100) continue; // only >100 SOL

        const amountUsd = amountSol * (tx.solPrice || 140);

        await supabase.from("whale_alerts").upsert({
          wallet_from: transfer.fromUserAccount,
          wallet_to: transfer.toUserAccount,
          amount_sol: amountSol,
          amount_usd: amountUsd,
          token_symbol: "SOL",
          tx_type: "transfer",
          tx_signature: tx.signature,
        }, { onConflict: "tx_signature" });
      }

      // Large token swaps
      if (tx.type === "SWAP" && tx.tokenTransfers?.length > 0) {
        const mainTransfer = tokenTransfers[0];
        const amountUsd = mainTransfer?.tokenAmount * (mainTransfer?.tokenPrice || 0);

        if (amountUsd < 5000) continue; // only >$5000 swaps

        await supabase.from("whale_alerts").upsert({
          wallet_from: mainTransfer?.fromUserAccount,
          wallet_to: mainTransfer?.toUserAccount,
          amount_sol: amountUsd / 140,
          amount_usd: amountUsd,
          token_symbol: mainTransfer?.mint?.slice(0, 6) || "TOKEN",
          tx_type: "swap",
          tx_signature: tx.signature,
        }, { onConflict: "tx_signature" });
      }
    }

    return new Response("ok", { status: 200, headers: corsHeaders });

  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
});