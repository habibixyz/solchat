import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { supabase } from "../lib/supabase";

const RECEIVER = new PublicKey("A3vfDdCu4y5EaVxKqnHmEKjwa2SaMhCZm9wbUQZrA8CV");

export async function sendPaidMessage(
  wallet: any,
  connection: any,
  messageText: string,
  profileName: string = "guest"
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  if (!messageText.trim()) throw new Error("Message is empty");

  // Step 1 — Pay 0.001 SOL
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: RECEIVER,
      lamports: 0.001 * LAMPORTS_PER_SOL,
    })
  );

  const signature = await wallet.sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature, "confirmed");

  // Step 2 — Save message to Supabase
  const { error } = await supabase.from("messages").insert({
    username: profileName,
    text: messageText,
    tx_signature: signature,
  });
  

  if (error) throw new Error(`Failed to save message: ${error.message}`);

  // Step 3 — Trigger AI if @ai mentioned
  if (messageText.toLowerCase().includes("@ai")) {
    console.log("🤖 Triggering AI...");
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    console.log("URL:", supabaseUrl);

    await fetch(`${supabaseUrl}/functions/v1/ai-respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ message: messageText, username: profileName }),
    });
  }

  return signature;
}