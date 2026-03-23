import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const BAGS_API_KEY = Deno.env.get("BAGS_API_KEY");
const BASE = "https://public-api-v2.bags.fm/api/v1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    if (!BAGS_API_KEY) {
      return json({ success: false, debug: "Missing BAGS_API_KEY env" }, 500);
    }

    const body = await req.json();
    console.log("REQ BODY:", body);

    const {
      name,
      symbol,
      description,
      imageUrl,
      imageBase64,
      imageMimeType,
      website,
      twitter,
      telegram,
      initialBuyLamports,
      payerPublicKey,
    } = body;

    // ✅ STRICT VALIDATION (fixes your "expected string" error)
    if (
      typeof name !== "string" ||
      typeof symbol !== "string" ||
      typeof description !== "string" ||
      typeof payerPublicKey !== "string"
    ) {
      return json({
        success: false,
        debug: "Invalid or missing required fields",
        body,
      }, 400);
    }

    // ───── STEP 1: CREATE TOKEN INFO ─────
    const fd = new FormData();

    fd.append("name", name.trim().slice(0, 32));
    fd.append("symbol", symbol.trim().toUpperCase().replace("$", "").slice(0, 10));
    fd.append("description", description.trim().slice(0, 1000));

    if (website) fd.append("website", String(website));
    if (twitter) fd.append("twitter", String(twitter).replace(/^@/, ""));
    if (telegram) fd.append("telegram", String(telegram).replace(/^@/, ""));

    if (imageBase64 && imageMimeType) {
      const bin = atob(imageBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }

      fd.append(
        "image",
        new Blob([bytes], { type: imageMimeType }),
        "token.png"
      );
    } else if (imageUrl) {
      fd.append("imageUrl", String(imageUrl));
    } else {
      return json({ success: false, debug: "No image provided" }, 400);
    }

    const res1 = await fetch(`${BASE}/token-launch/create-token-info`, {
      method: "POST",
      headers: { "x-api-key": BAGS_API_KEY },
      body: fd,
    });

    const raw1 = await res1.text();
    console.log("STEP1 RAW:", raw1);

    if (!res1.ok) {
      return json({ success: false, step: 1, debug: raw1 }, 500);
    }

    let step1;
    try {
      step1 = JSON.parse(raw1);
    } catch {
      return json({ success: false, step: 1, debug: raw1 }, 500);
    }

    const tokenMint = step1?.response?.tokenMint;
    const tokenMetadata = step1?.response?.tokenMetadata;

    if (!tokenMint || !tokenMetadata) {
      return json({
        success: false,
        step: 1,
        debug: "Missing tokenMint/tokenMetadata",
        raw: step1,
      }, 500);
    }

    console.log("TOKEN:", tokenMint);

    // ───── STEP 2: CREATE LAUNCH TX ─────
    const launchBody = {
      ipfs: String(tokenMetadata),
      tokenMint: String(tokenMint),
      wallet: String(payerPublicKey),
      initialBuyLamports: Number(initialBuyLamports) || 0,
    };

    console.log("STEP2 BODY:", launchBody);

    const res2 = await fetch(`${BASE}/token-launch/create-launch-transaction`, {
      method: "POST",
      headers: {
        "x-api-key": BAGS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(launchBody),
    });

    const raw2 = await res2.text();
    console.log("STEP2 RAW:", raw2);

    if (!res2.ok) {
      return json({
        success: false,
        step: 2,
        debug: raw2,
        sent: launchBody,
      }, 500);
    }

    let step2;
    try {
      step2 = JSON.parse(raw2);
    } catch {
      return json({ success: false, step: 2, debug: raw2 }, 500);
    }

    if (!step2.success) {
      return json({
        success: false,
        step: 2,
        debug: step2,
      }, 500);
    }

    // ✅ SUCCESS
    return json({
      success: true,
      tokenMint,
      tokenMetadata,
      launchTransaction: step2.response,
      configTransactions: [],
    });

  } catch (e: any) {
    console.error("FATAL:", e);
    return json({
      success: false,
      debug: e?.message || "Internal error",
    }, 500);
  }
});