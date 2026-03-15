import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const AI_RATE_LIMIT = 5; // per hour per user

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, username } = await req.json();

    if (!message?.toLowerCase().includes("@ai")) {
      return new Response("no trigger", { status: 200, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ✅ Rate limit check — max 5 @ai messages per user per hour
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("username", username)
      .ilike("text", "%@ai%")
      .gte("created_at", oneHourAgo);

    if (count && count >= AI_RATE_LIMIT) {
      // Save a rate limit message to feed so user sees it
      await supabase.from("messages").insert({
        username: "AI",
        text: `@${username} — you've reached the limit of ${AI_RATE_LIMIT} @ai messages per hour. come back later.`,
      });
      return new Response("rate limited", { status: 429, headers: corsHeaders });
    }

    const { data: history } = await supabase
      .from("messages")
      .select("username, text")
      .order("created_at", { ascending: false })
      .limit(20);

    const historyMessages = (history || [])
      .reverse()
      .map((m: any) => ({
        role: m.username === "AI" ? "assistant" : "user",
        content: `[${
          m.username.length > 20
            ? m.username.slice(0, 4) + "..." + m.username.slice(-4)
            : m.username
        }]: ${m.text}`,
      }));

    const messages = historyMessages.length > 0 ? historyMessages : [
      { role: "user", content: `[${username}]: ${message}` }
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: `You are SolChat AI — the oracle of a public Solana chat feed.
Be concise and sharp. Max 2-3 sentences.
You are crypto-native. You understand Solana, DeFi, NFTs, wallets.
Never give financial advice.
Always respond directly to what was asked. No fluff.`,
          },
          ...messages,
        ],
      }),
    });

    const aiData = await response.json();
    const aiText = aiData?.choices?.[0]?.message?.content;
    if (!aiText) throw new Error(`Groq failed: ${JSON.stringify(aiData)}`);

    const { error } = await supabase.from("messages").insert({
      username: "AI",
      text: aiText,
    });

    if (error) throw new Error(error.message);

    return new Response("ok", { status: 200, headers: corsHeaders });

  } catch (err: any) {
    console.error("Edge function error:", err);
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
});