import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const AI_RATE_LIMIT = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, walletAddress } = await req.json();

    if (!message?.toLowerCase().includes("@ai")) {
      return new Response("no trigger", { status: 200, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ✅ RATE LIMIT
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("user_id", walletAddress)
      .ilike("content", "%@ai%")
      .gte("created_at", oneHourAgo);

    if (count && count >= AI_RATE_LIMIT) {
      await supabase.from("messages").insert({
        user_id: "AI",
        content: `@${walletAddress} — limit of ${AI_RATE_LIMIT} @ai messages reached.`,
      });

      return new Response("rate limited", { status: 429, headers: corsHeaders });
    }

    // ✅ FETCH HISTORY
    const { data: history } = await supabase
      .from("messages")
      .select("user_id, content")
      .order("created_at", { ascending: false })
      .limit(20);

    const historyMessages = (history || [])
      .reverse()
      .map((m) => ({
        role: m.user_id === "AI" ? "assistant" : "user",
        content: `${formatUser(m.user_id)}: ${m.content}`,
      }));

    const messages =
      historyMessages.length > 0
        ? historyMessages
        : [{ role: "user", content: `${walletAddress}: ${message}` }];

    // ✅ CALL GROQ
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: `You are SolChat AI. Be sharp, crypto-native, max 2-3 sentences.`,
          },
          ...messages,
        ],
      }),
    });

    const aiData = await response.json();
    const aiText = aiData?.choices?.[0]?.message?.content;

    if (!aiText) throw new Error("AI response failed");

    // ✅ INSERT AI RESPONSE
    const { error } = await supabase.from("messages").insert({
      user_id: "AI",
      content: aiText,
    });

    if (error) throw new Error(error.message);

    return new Response("ok", { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
});

// helper
function formatUser(userId) {
  if (!userId) return "unknown";
  return userId.length > 20
    ? userId.slice(0, 4) + "..." + userId.slice(-4)
    : userId;
}