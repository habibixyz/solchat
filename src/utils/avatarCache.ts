// src/utils/avatarCache.ts
// Lightweight in-memory cache for avatar URLs (wallet + username)

import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────
// Wallet-based cache
// ─────────────────────────────────────────
const walletCache: Record<string, string | null> = {};
const walletPending: Record<string, Promise<string | null>> = {};

export async function getAvatar(wallet: string): Promise<string | null> {
  if (!wallet) return null;

  if (wallet in walletCache) return walletCache[wallet];
  if (wallet in walletPending) return walletPending[wallet];

  walletPending[wallet] = (async () => {
    try {
      const { data } = await supabase
        .from('usernames')
        .select('avatar_url')
        .eq('wallet_address', wallet)
        .maybeSingle();

      const url = data?.avatar_url ?? null;
      walletCache[wallet] = url;
      return url;
    } catch {
      walletCache[wallet] = null;
      return null;
    } finally {
      delete walletPending[wallet];
    }
  })();

  return walletPending[wallet];
}

// ─────────────────────────────────────────
// Username-based cache
// ─────────────────────────────────────────
const usernameCache: Record<string, string | null> = {};
const usernamePending: Record<string, Promise<string | null>> = {};

export async function getAvatarByUsername(username: string): Promise<string | null> {
  if (!username || username === 'AI') return null;

  if (username in usernameCache) return usernameCache[username];
  if (username in usernamePending) return usernamePending[username];

  usernamePending[username] = (async () => {
    try {
      const { data } = await supabase
        .from('usernames')
        .select('avatar_url')
        .eq('username', username)
        .maybeSingle();

      const url = data?.avatar_url ?? null;
      usernameCache[username] = url;
      return url;
    } catch {
      usernameCache[username] = null;
      return null;
    } finally {
      delete usernamePending[username];
    }
  })();

  return usernamePending[username];
}

// ─────────────────────────────────────────
// Preload avatars (batch fetch)
// ─────────────────────────────────────────
export async function preloadAvatars(usernames: string[]): Promise<void> {
  const unique = [...new Set(usernames)].filter(
    u => u && u !== 'AI' && !(u in usernameCache)
  );

  if (!unique.length) return;

  let data: any[] = [];

  try {
    const res = await supabase
      .from('usernames')
      .select('username, avatar_url')
      .in('username', unique);

    data = res.data ?? [];
  } catch {
    data = [];
  }

  data.forEach((row: any) => {
    usernameCache[row.username] = row.avatar_url ?? null;
  });

  unique.forEach(u => {
    if (!(u in usernameCache)) usernameCache[u] = null;
  });
}

// ─────────────────────────────────────────
// Cache invalidation
// ─────────────────────────────────────────
export function invalidateAvatar(wallet?: string, username?: string) {
  if (wallet) {
    delete walletCache[wallet];
    delete walletPending[wallet];
  }

  if (username) {
    delete usernameCache[username];
    delete usernamePending[username];
  }
}