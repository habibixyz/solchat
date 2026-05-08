import { supabase } from '../lib/supabase';
import { createMentionNotifications, createReplyNotification } from './notificationService';
import { SystemProgram, Transaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

export const DAILY_FREE_MESSAGE_LIMIT = 5;

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function fetchDailyMessageCount(walletAddress: string): Promise<number> {
  if (!walletAddress) return 0;

  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('wallet_address', walletAddress)
    .gte('created_at', startOfTodayIso());

  if (error) {
    console.warn('Daily count unavailable:', error.message);
    return 0;
  }

  return count ?? 0;
}

function rememberLocalSend(walletAddress: string) {
  if (!walletAddress) return;
  const key = `solchat_daily_${walletAddress}_${new Date().toISOString().slice(0, 10)}`;
  localStorage.setItem(key, String(Number(localStorage.getItem(key) || 0) + 1));
}

export async function sendPaidMessage(
  wallet: any,
  connection: any,
  messageText: string,
  profileName = 'guest',
  replyToId: string | null = null
) {
  const walletAddress = wallet?.publicKey?.toBase58?.();
  const text = messageText.trim();

  if (!walletAddress) throw new Error('Wallet not connected');
  if (!text) throw new Error('Message is empty');
  if (!profileName || profileName === 'guest') throw new Error('Set a username first');

  const usedToday = await fetchDailyMessageCount(walletAddress);

  let txSignature = `free:${walletAddress}:${Date.now()}`;

  // 🚀 PAID FLOW AFTER 5 MESSAGES
  if (usedToday >= DAILY_FREE_MESSAGE_LIMIT) {

    if (!wallet?.publicKey || !wallet?.sendTransaction) {
      throw new Error('Wallet not ready');
    }

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: new PublicKey("A3vfDdCu4y5EaVxKqnHmEKjwa2SaMhCZm9wbUQZrA8CV"), // 🔥 CHANGE THIS
        lamports: 0.001 * LAMPORTS_PER_SOL,
      })
    );

    try {
      txSignature = await wallet.sendTransaction(tx, connection);
    } catch (err) {
      throw new Error('Transaction cancelled');
    }
  }

  // ✅ MESSAGE PAYLOAD
  const payload: any = {
    username: profileName,
    wallet_address: walletAddress,
    text,
    tx_signature: txSignature
  };

  // ✅ REPLY SUPPORT
  if (replyToId) {
    payload.reply_to_id = replyToId;

    const { data: original } = await supabase
      .from('messages')
      .select('username, text')
      .eq('id', replyToId)
      .maybeSingle();

    if (original) {
      payload.reply_preview = {
        username: original.username,
        text: original.text
      };
    }
  }

  // ✅ INSERT MESSAGE
  const { data, error } = await supabase
    .from('messages')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    console.error(error);
    throw new Error(error.message);
  }

  rememberLocalSend(walletAddress);

  // ✅ NOTIFICATIONS
  await createMentionNotifications(text, profileName, walletAddress, data.id).catch(console.warn);
  await createReplyNotification(replyToId, walletAddress, profileName, data.id, text).catch(console.warn);

  // 🤖 OPTIONAL AI RESPONSE
  if (text.toLowerCase().includes('@ai')) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      await fetch(`${supabaseUrl}/functions/v1/ai-respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          message: text,
          username: profileName,
        }),
      }).catch(console.warn);
    }
  }

  return data.id;
}