// Detect Solana mint address (32–44 base58 chars)
export const MINT_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;

export const TICKER_REGEX = /\$[A-Z]{2,10}\b/;