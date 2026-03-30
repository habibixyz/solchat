// src/services/notificationService.ts
import { supabase } from '../lib/supabase';

export interface Notification {
  id: string;
  recipient: string;
  sender_name: string;
  message_id: string;
  message_preview: string;
  read: boolean;
  created_at: string;
}

export function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_]{3,20})/g) ?? [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}

export async function createMentionNotifications(
  text: string,
  senderName: string,
  messageId: string
) {
  const mentions = extractMentions(text);
  if (!mentions.length) return;

  const { data: users } = await supabase
    .from('usernames')
    .select('wallet_address, username')
    .in('username', mentions);

  if (!users?.length) return;

  const preview = text.length > 80 ? text.slice(0, 80) + '…' : text;

  await supabase.from('notifications').insert(
    users.map((u: any) => ({
      recipient: u.wallet_address,
      sender_name: senderName,
      message_id: messageId,
      message_preview: preview,
    }))
  );
}

export async function fetchUnreadCount(wallet: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient', wallet)
    .eq('read', false);
  return count ?? 0;
}

export async function fetchNotifications(wallet: string, limit = 20): Promise<Notification[]> {
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
