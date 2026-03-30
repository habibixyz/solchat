import { createMentionNotifications } from './notificationService';
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { supabase } from "../lib/supabase";

const RECEIVER = new PublicKey("A3vfDdCu4y5EaVxKqnHmEKjwa2SaMhCZm9wbUQZrA8CV");

export async function sendPaidMessage(
  wallet: any,
  connection: any,
  messageText: string,
  profileName: string = "guest",
  replyToId: string | null = null
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

  // Step 2 — Build insert payload
  const payload: any = {
    username: profileName,
    text: messageText,
    tx_signature: signature,
  };

  // Attach reply info if replying
  if (replyToId) {
    payload.reply_to_id = replyToId;
    // Fetch the original message to store a preview
    const { data: original } = await supabase
      .from('messages')
      .select('username, text')
      .eq('id', replyToId)
      .single();
    if (original) {
      payload.reply_preview = { username: original.username, text: original.text };
    }
  }

  // Step 3 — Save message
  const { data: savedMsg, error } = await supabase
    .from("messages")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw new Error(`Failed to save message: ${error.message}`);

  // Step 4 — Mention notifications
  if (savedMsg?.id) {
    await createMentionNotifications(messageText, profileName, savedMsg.id)
      .catch(() => {});
  }

  // Step 5 — Trigger AI if @ai mentioned
  if (messageText.toLowerCase().includes("@ai")) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
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
