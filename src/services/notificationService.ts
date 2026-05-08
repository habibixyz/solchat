import { supabase } from '../lib/supabase';

export type NotificationType = 'mention' | 'reply';

export interface Notification {
  id: string;
  recipient: string;
  sender_name: string;
  message_id: string;
  message_preview: string;
  type?: NotificationType;
  read: boolean;
  created_at: string;
}

export function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_]{3,20})/g) ?? [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}

async function findMentionedUsers(mentions: string[]) {
  const users = await Promise.all(mentions.map(async mention => {
    const { data } = await supabase
      .from('usernames')
      .select('wallet_address, username')
      .ilike('username', mention)
      .maybeSingle();
    return data;
  }));

  return users.filter(Boolean) as { wallet_address: string; username: string }[];
}

export async function createMentionNotifications(
  text: string,
  senderName: string,
  senderWallet: string,
  messageId: string
) {
  const mentions = extractMentions(text);
  if (!mentions.length) return;

  const users = await findMentionedUsers(mentions);
  if (!users.length) return;

  const preview = text.length > 90 ? `${text.slice(0, 90)}...` : text;
  const rows = users
    .filter(u => u.wallet_address !== senderWallet)
    .map(u => ({
      recipient: u.wallet_address,
      sender_name: senderName,
      message_id: messageId,
      message_preview: preview,
      type: 'mention' as NotificationType,
    }));

  if (rows.length) await supabase.from('notifications').insert(rows);
}

export async function createReplyNotification(
  replyToId: string | null,
  senderWallet: string,
  senderName: string,
  messageId: string,
  text: string
) {
  if (!replyToId || !senderWallet) return;

  const { data: parent } = await supabase
    .from('messages')
    .select('wallet_address, user_id, sender_wallet')
    .eq('id', replyToId)
    .maybeSingle();

  const recipient = parent?.wallet_address || parent?.sender_wallet || parent?.user_id;
  if (!recipient || recipient === senderWallet) return;

  const preview = text.length > 90 ? `${text.slice(0, 90)}...` : text;
  await supabase.from('notifications').insert({
    recipient,
    sender_name: senderName,
    message_id: messageId,
    message_preview: preview,
    type: 'reply',
  });
}

export async function fetchUnreadCount(wallet: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient', wallet)
    .eq('read', false);

  return count ?? 0;
}

export async function fetchNotifications(wallet: string, limit = 30): Promise<Notification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient', wallet)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as Notification[];
}

export async function markAllRead(wallet: string) {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient', wallet)
    .eq('read', false);
}
