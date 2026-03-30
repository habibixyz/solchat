// src/services/ethosService.ts
// CONFIRMED endpoint: POST /api/v2/users/by/x
// Score is embedded in user object — no separate score call needed
const BASE = 'https://api.ethos.network/api/v2';
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Ethos-Client': 'solchat@1.0',
};

export interface EthosScore {
  score: number;
  level: 'untrusted' | 'questionable' | 'neutral' | 'reputable' | 'exemplary';
}

export interface EthosReviewStats {
  positive: number;
  neutral: number;
  negative: number;
}

export interface EthosProfile {
  score: EthosScore | null;
  reviewStats: EthosReviewStats | null;
  vouchCount: number;
  profileUrl: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export const LEVEL_COLOR: Record<string, string> = {
  exemplary:    '#00ff88',
  reputable:    '#00f7ff',
  neutral:      '#7c5cff',
  questionable: '#ffaa00',
  untrusted:    '#ff4444',
};

function scoreToLevel(score: number): EthosScore['level'] {
  if (score >= 1600) return 'exemplary';
  if (score >= 1200) return 'reputable';
  if (score >= 800)  return 'neutral';
  if (score >= 400)  return 'questionable';
  return 'untrusted';
}

export async function getEthosProfile(twitterHandle: string): Promise<EthosProfile> {
  const handle = twitterHandle.replace(/^@/, '').trim();
  const profileUrl = `https://app.ethos.network/profile/x/${handle}`;

  try {
    // CONFIRMED: POST /api/v2/users/by/x with accountIdsOrUsernames
    const res = await fetch(`${BASE}/users/by/x`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ accountIdsOrUsernames: [handle] }),
    });

    if (!res.ok) {
      console.log('[Ethos] users/by/x status:', res.status);
      return { score: null, reviewStats: null, vouchCount: 0, profileUrl, displayName: null, avatarUrl: null };
    }

    const data = await res.json();
    console.log('[Ethos] users/by/x response:', data);

    // Response is an array of users
    const users = Array.isArray(data) ? data : (data?.values ?? data?.users ?? []);
    const user = users[0] ?? null;

    if (!user) {
      return { score: null, reviewStats: null, vouchCount: 0, profileUrl, displayName: null, avatarUrl: null };
    }

    // Score is directly on the user object
    const rawScore = user.score ?? null;
    const score: EthosScore | null = rawScore !== null
      ? { score: rawScore, level: scoreToLevel(rawScore) }
      : null;

    // Review stats from user.stats
    const reviewStats: EthosReviewStats | null = user.stats?.review?.received
      ? {
          positive: user.stats.review.received.positive ?? 0,
          neutral:  user.stats.review.received.neutral ?? 0,
          negative: user.stats.review.received.negative ?? 0,
        }
      : null;

    // Vouch count from user.stats
    const vouchCount = user.stats?.vouch?.received?.count ?? 0;

    return {
      score,
      reviewStats,
      vouchCount,
      profileUrl,
      displayName: user.displayName ?? user.username ?? null,
      avatarUrl: user.avatarUrl ?? null,
    };

  } catch (e) {
    console.error('[Ethos] error:', e);
    return { score: null, reviewStats: null, vouchCount: 0, profileUrl, displayName: null, avatarUrl: null };
  }
}
