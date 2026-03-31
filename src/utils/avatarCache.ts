// src/utils/avatarCache.ts
// Lightweight in-memory cache for avatar URLs (wallet + username)
// Dedupes requests, prevents refetch spam, supports cache invalidation

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

  walletPending[wallet] = supabase
    .from('usernames')
    .select('avatar_url')
    .eq('wallet_address', wallet)
    .maybeSingle()
    .then(({ data }) => {
      const url = data?.avatar_url ?? null;
      walletCache[wallet] = url;
      delete walletPending[wallet];
      return url;
    })
    .catch(() => {
      walletCache[wallet] = null;
      delete walletPending[wallet];
      return null;
    });

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

  usernamePending[username] = supabase
    .from('usernames')
    .select('avatar_url')
    .eq('username', username)
    .maybeSingle()
    .then(({ data }) => {
      const url = data?.avatar_url ?? null;
      usernameCache[username] = url;
      delete usernamePending[username];
      return url;
    })
    .catch(() => {
      usernameCache[username] = null;
      delete usernamePending[username];
      return null;
    });

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

  const { data } = await supabase
    .from('usernames')
    .select('username, avatar_url')
    .in('username', unique)
    .catch(() => ({ data: [] }));

  (data ?? []).forEach((row: any) => {
    usernameCache[row.username] = row.avatar_url ?? null;
  });

  // mark missing ones as null (avoid refetch loops)
  unique.forEach(u => {
    if (!(u in usernameCache)) usernameCache[u] = null;
  });
}

// ─────────────────────────────────────────
// Cache invalidation (VERY IMPORTANT)
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